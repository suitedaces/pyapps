import modal
import asyncio
from playwright.async_api import async_playwright
import os
import boto3
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Request model
class ScreenshotRequest(BaseModel):
    user_id: str
    app_id: str
    version_number: int
    url: str

# Create Modal image with required dependencies
image = modal.Image.debian_slim().run_commands(
    "apt-get update",
    "apt-get install -y software-properties-common",
    "apt-add-repository non-free",
    "apt-add-repository contrib",
    "pip install playwright fastapi python-multipart boto3",
    "playwright install-deps chromium",
    "playwright install chromium",
)

web_app = FastAPI()
app = modal.App("py-apps-screenshot")

@web_app.post("/screenshot")
async def handle_screenshot(request: ScreenshotRequest):
    try:
        # Take screenshot using Playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            print(f"📸 Taking screenshot of {request.url}")
            await page.goto(request.url)
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(25)  # Wait for animations
            
            # Save screenshot temporarily
            temp_path = "/tmp/preview.png"
            await page.screenshot(path=temp_path, full_page=False)
            await browser.close()

            # Get AWS credentials from environment
            s3 = boto3.client('s3',
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                region_name=os.getenv('AWS_REGION')
            )
            bucket = os.getenv('AWS_S3_BUCKET')
            
            # Upload to S3
            s3_path = f"{request.user_id}/apps/{request.app_id}/{request.version_number}/preview.png"
            s3.upload_file(temp_path, bucket, s3_path)
            
            # Clean up temp file
            os.remove(temp_path)
            
            print(f"✅ Screenshot uploaded to s3://{bucket}/{s3_path}")
            return {
                "success": True, 
                "path": s3_path,
                "user_id": request.user_id,
                "app_id": request.app_id,
                "version_number": request.version_number
            }

    except Exception as e:
        print(f"❌ Screenshot failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Deploy the FastAPI app with Modal
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("aws-credentials")]  # Use the AWS credentials secret
)
@modal.asgi_app()
def fastapi_app():
    return web_app