import { Sandbox as E2BSandbox } from '@e2b/code-interpreter'

export interface SandboxMetadata {
    userId: string;
    [key: string]: any;
}

export interface RunningSandbox {
    sandboxId: string;
    metadata?: SandboxMetadata;
    startedAt: Date;
    templateId: string;
}

export interface SandboxProcess {
    pid: number;
    cmd: string;
}

export class Sandbox {
    static async create(metadata?: SandboxMetadata) {
        const sandbox = await E2BSandbox.create('streamlit-sandbox-me2', {
            apiKey: process.env.E2B_API_KEY,
            timeoutMs: 5 * 60 * 1000, // 5 minutes
            metadata
        })
        return {
            ...sandbox,
            sandboxId: sandbox.sandboxId // Ensure we expose sandboxId
        }
    }

    static async connect(sandboxId: string) {
        const sandbox = await E2BSandbox.connect(sandboxId)
        return {
            ...sandbox,
            sandboxId // Ensure we expose sandboxId
        }
    }

    static async reconnect(sandboxId: string) {
        try {
            return await this.connect(sandboxId)
        } catch (error) {
            console.log('Failed to reconnect, creating new sandbox')
            return await this.create()
        }
    }

    static async killProcess(sandbox: E2BSandbox, name: string) {
        try {
            await sandbox.kill(id)
        } catch (error) {
            console.error('Error killing process:', error)
        }
    }
} 