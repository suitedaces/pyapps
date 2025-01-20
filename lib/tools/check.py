import subprocess

def check_python(filename="app.py"):
    try:
        result = subprocess.run(
            ["python", filename], 
            capture_output=True,
            text=True
        )
        # Filter for actual error messages
        error_lines = []
        for line in result.stderr.split("\n"):
            if ('Error:' in line or 
                'Exception:' in line or 
                'Traceback' in line):
                error_lines.append(line.strip())
        return "\n".join(error_lines)
    except Exception as e:
        return str(e)

if __name__ == "__main__":
    print(check_python()) 