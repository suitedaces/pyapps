import { Sandbox } from 'e2b'
import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// Constants
const E2B_COST_PER_SECOND = 0.000028 // 2 vCPUs cost/second
const REPORT_FILE = 's3_performance_report.txt'
const TEST_FILE_CONTENT = `This is a test file for S3FS performance testing.
It includes multiple lines of text to simulate a real document.
We'll use this for read/write performance testing.
The file contains various lengths of content to test different scenarios.
${'-'.repeat(1000)}\n`.repeat(10) // Creates a sizable test file

class PerformanceReport {
    constructor() {
        this.startTime = Date.now()
        this.operations = []
        this.content = []
        this.errors = []
    }

    addLine(text = '') {
        this.content.push(text)
    }

    addError(error) {
        this.errors.push(error.toString())
    }

    addOperation(name, duration, cost, startUsage, endUsage, details = {}) {
        this.operations.push({
            name,
            duration,
            cost,
            startUsage,
            endUsage,
            ...details,
        })
    }

    formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        if (bytes === 0) return '0 Byte'
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i]
    }

    async write() {
        const totalDuration = (Date.now() - this.startTime) / 1000
        const totalCost = totalDuration * E2B_COST_PER_SECOND

        const report = [
            '='.repeat(100),
            'S3FS Performance Test Report'.padStart(65),
            '='.repeat(100),
            '',
            `Generated: ${new Date().toISOString()}`,
            `Test Duration: ${totalDuration.toFixed(2)} seconds`,
            '',
            '-'.repeat(100),
            'Cost Analysis'.padStart(60),
            '-'.repeat(100),
            `Current Test Cost:        $${totalCost.toFixed(6)}`,
            `Hourly Cost:             $${(E2B_COST_PER_SECOND * 3600).toFixed(6)}`,
            `Daily Cost (24h):        $${(E2B_COST_PER_SECOND * 3600 * 24).toFixed(4)}`,
            `Monthly Cost (30d):      $${(E2B_COST_PER_SECOND * 3600 * 24 * 30).toFixed(2)}`,
            '',
            '-'.repeat(100),
            'Performance Tests'.padStart(63),
            '-'.repeat(100),
            '',
            ...this.operations
                .map((op) => [
                    `Test: ${op.name}`,
                    `Duration:          ${op.duration.toFixed(2)}s`,
                    `Cost:             $${op.cost.toFixed(6)}`,
                    `Transfer Rate:     ${op.bytesPerSecond ? this.formatBytes(op.bytesPerSecond) + '/s' : 'N/A'}`,
                    '',
                    'Resource Usage Before:',
                    op.startUsage,
                    '',
                    'Resource Usage After:',
                    op.endUsage,
                    '',
                    Object.entries(op)
                        .filter(
                            ([key]) =>
                                ![
                                    'name',
                                    'duration',
                                    'cost',
                                    'startUsage',
                                    'endUsage',
                                    'bytesPerSecond',
                                ].includes(key)
                        )
                        .map(([key, value]) => `${key}: ${value}`)
                        .join('\n'),
                    '',
                    '-'.repeat(50),
                    '',
                ])
                .flat(),
            '',
            this.content.length
                ? [
                      '-'.repeat(100),
                      'Additional Information'.padStart(65),
                      '-'.repeat(100),
                      ...this.content,
                      '',
                  ].flat()
                : [],
            this.errors.length
                ? [
                      '-'.repeat(100),
                      'Errors'.padStart(57),
                      '-'.repeat(100),
                      ...this.errors,
                      '',
                  ].flat()
                : [],
            '='.repeat(100),
            'End of Report'.padStart(60),
            '='.repeat(100),
        ].flat()

        await fs.writeFile(REPORT_FILE, report.join('\n'))
        console.log(`\nDetailed report written to ${REPORT_FILE}`)
    }
}

async function getAWSCredentials() {
    try {
        const credentialsPath = join(homedir(), '.aws', 'credentials')
        const configPath = join(homedir(), '.aws', 'config')

        const credentials = await fs.readFile(credentialsPath, 'utf8')
        const config = await fs.readFile(configPath, 'utf8')

        const accessKeyMatch = credentials.match(/aws_access_key_id\s*=\s*(.+)/)
        const secretKeyMatch = credentials.match(
            /aws_secret_access_key\s*=\s*(.+)/
        )
        const regionMatch = config.match(/region\s*=\s*(.+)/)

        if (!accessKeyMatch || !secretKeyMatch) {
            throw new Error('Missing AWS credentials')
        }

        return {
            accessKeyId: accessKeyMatch[1].trim(),
            secretAccessKey: secretKeyMatch[1].trim(),
            region: regionMatch?.[1]?.trim() || 'us-east-1',
        }
    } catch (error) {
        console.error('Failed to read AWS credentials:', error)
        process.exit(1)
    }
}

async function getResourceUsage(sandbox) {
    const result = await sandbox.process.start({
        cmd: `
            echo "Memory Usage:"
            free -h
            echo -e "\nCPU Usage:"
            top -b -n 1 | head -n 5
            echo -e "\nS3FS Process:"
            ps aux | grep s3fs | grep -v grep
        `,
    })
    return result.stdout
}

async function testS3Performance() {
    const report = new PerformanceReport()
    console.log('🚀 Starting S3 performance test...')

    const creds = await getAWSCredentials()
    const sandbox = await Sandbox.create({
        apiKey:
            process.env.E2B_API_KEY ||
            'e2b_45ff57d2cbb35f978d452964b459efad92e97c61',
        template: 'streamlit-sandbox-s3',
    })

    report.addLine(`Sandbox ID: ${sandbox.id}`)
    report.addLine(`Region: ${creds.region}`)
    report.addLine()

    try {
        // Mount S3
        await sandbox.process.start({
            cmd: `
                echo "${creds.accessKeyId}:${creds.secretAccessKey}" | sudo tee /etc/passwd-s3fs > /dev/null &&
                sudo chmod 600 /etc/passwd-s3fs &&
                sudo s3fs pyapps /app/s3 -o passwd_file=/etc/passwd-s3fs -o url="https://s3.amazonaws.com" \
                -o endpoint=${creds.region} -o allow_other -o umask=0000 -o use_path_request_style &
                sleep 2
            `,
        })

        // Verify mount
        const mountCheck = await sandbox.process.start({
            cmd: 'mountpoint -q /app/s3 && echo "✅ S3 mounted" || echo "❌ S3 not mounted"',
        })
        report.addLine('Mount Status: ' + mountCheck.stdout)

        // Performance tests
        const tests = [
            {
                name: 'Write 1MB Random Data',
                cmd: 'dd if=/dev/urandom of=/app/s3/test_1mb.bin bs=1M count=1 status=progress',
                size: 1024 * 1024,
            },
            {
                name: 'Write 10MB Random Data',
                cmd: 'dd if=/dev/urandom of=/app/s3/test_10mb.bin bs=1M count=10 status=progress',
                size: 10 * 1024 * 1024,
            },
            {
                name: 'Write Large Text File',
                prepare: async () => {
                    await sandbox.process.start({
                        cmd: `echo '${TEST_FILE_CONTENT}' > /app/s3/test_file.txt`,
                    })
                },
            },
            {
                name: 'Read 1MB File',
                cmd: 'dd if=/app/s3/test_1mb.bin of=/dev/null bs=1M status=progress',
                size: 1024 * 1024,
            },
            {
                name: 'Read 10MB File',
                cmd: 'dd if=/app/s3/test_10mb.bin of=/dev/null bs=1M status=progress',
                size: 10 * 1024 * 1024,
            },
            {
                name: 'Create 100 Small Files',
                cmd: `for i in {1..100}; do echo "test content $i" > "/app/s3/test_$i.txt"; done`,
                size: 100 * 20, // Approximate size of each file
            },
            {
                name: 'Read 100 Small Files',
                cmd: `for i in {1..100}; do cat "/app/s3/test_$i.txt" > /dev/null; done`,
                size: 100 * 20,
            },
        ]

        for (const test of tests) {
            const start = Date.now()
            const startUsage = await getResourceUsage(sandbox)

            if (test.prepare) {
                await test.prepare()
            }

            if (test.cmd) {
                await sandbox.process.start({
                    cmd: test.cmd,
                    onStderr: console.error,
                })
            }

            const endUsage = await getResourceUsage(sandbox)
            const duration = (Date.now() - start) / 1000
            const cost = duration * E2B_COST_PER_SECOND
            const bytesPerSecond = test.size ? test.size / duration : undefined

            report.addOperation(
                test.name,
                duration,
                cost,
                startUsage,
                endUsage,
                {
                    bytesPerSecond,
                }
            )
        }

        // Memory stress test
        const start = Date.now()
        const startUsage = await getResourceUsage(sandbox)

        await sandbox.process.start({
            cmd: `
                echo "Starting memory stress test..."
                for i in {1..50}; do
                    dd if=/dev/urandom of=/app/s3/stress_$i.bin bs=1M count=2 2>/dev/null &
                done
                wait
                echo "Memory stress test complete"
                free -h
            `,
            onStdout: (data) => report.addLine(data),
        })

        const endUsage = await getResourceUsage(sandbox)
        const duration = (Date.now() - start) / 1000
        const cost = duration * E2B_COST_PER_SECOND

        report.addOperation(
            'Memory Stress Test (100MB parallel writes)',
            duration,
            cost,
            startUsage,
            endUsage
        )

        // Cleanup
        await sandbox.process.start({
            cmd: 'rm -rf /app/s3/test_* /app/s3/stress_*',
        })
    } catch (error) {
        report.addError(error)
        console.error('Error during tests:', error)
    } finally {
        await sandbox.close()
        await report.write()
    }
}

console.log('Starting S3FS performance test suite...')
testS3Performance().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
})
