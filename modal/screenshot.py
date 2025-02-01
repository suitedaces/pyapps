import modal
import asyncio
from playwright.async_api import async_playwright
import os
import boto3
import logging
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Request model
class ScreenshotRequest(BaseModel):
    user_id: str
    app_id: str
    version_number: int
    url: str

    def get_request_metadata(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "app_id": self.app_id,
            "version": self.version_number,
            "url": self.url
        }

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
    start_time = time.time()
    request_id = f"{request.user_id}-{request.app_id}-{request.version_number}"
    logger.info(f"Starting screenshot process for request {request_id}", extra=request.get_request_metadata())

    try:
        # Take screenshot using Playwright
        async with async_playwright() as p:
            logger.info(f"[{request_id}] Launching browser")
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            logger.info(f"[{request_id}] Navigating to URL: {request.url}")
            await page.goto(request.url)
            
            logger.info(f"[{request_id}] Waiting for network idle state")
            await page.wait_for_load_state("networkidle")
            
            logger.info(f"[{request_id}] Waiting for animations to complete")
            await asyncio.sleep(50)  # Wait for animations
            
            # Save screenshot temporarily
            temp_path = "/tmp/preview.png"
            logger.info(f"[{request_id}] Taking screenshot")
            await page.screenshot(path=temp_path, full_page=False)
            logger.info(f"[{request_id}] Screenshot saved to temporary file: {temp_path}")
            
            await browser.close()
            logger.info(f"[{request_id}] Browser closed")

            # Get AWS credentials from environment
            logger.info(f"[{request_id}] Initializing S3 client")
            s3 = boto3.client('s3',
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                region_name=os.getenv('AWS_REGION')
            )
            bucket = os.getenv('AWS_S3_BUCKET')
            
            # Upload to S3
            s3_path = f"{request.user_id}/apps/{request.app_id}/{request.version_number}/preview.png"
            logger.info(f"[{request_id}] Uploading to S3: s3://{bucket}/{s3_path}")
            upload_start = time.time()
            s3.upload_file(temp_path, bucket, s3_path)
            upload_duration = time.time() - upload_start
            logger.info(f"[{request_id}] Upload completed in {upload_duration:.2f}s")
            
            # Clean up temp file
            os.remove(temp_path)
            logger.info(f"[{request_id}] Temporary file cleaned up")
            
            total_duration = time.time() - start_time
            logger.info(f"[{request_id}] Process completed successfully in {total_duration:.2f}s")
            
            return {
                "success": True, 
                "path": s3_path,
                "user_id": request.user_id,
                "app_id": request.app_id,
                "version_number": request.version_number,
                "duration_seconds": total_duration
            }

    except Exception as e:
        total_duration = time.time() - start_time
        error_context = {
            "request_id": request_id,
            "error_type": type(e).__name__,
            "error_message": str(e),
            "duration_seconds": total_duration,
            **request.get_request_metadata()
        }
        logger.error(f"[{request_id}] Screenshot failed after {total_duration:.2f}s", 
                    exc_info=True, 
                    extra=error_context)
        raise HTTPException(status_code=500, detail={
            "error": str(e),
            "error_type": type(e).__name__,
            "request_id": request_id
        })

# Deploy the FastAPI app with Modal
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("aws-credentials")],  # Use the AWS credentials secret
    timeout=150  # 2.5 minute timeout
)
@modal.asgi_app()
def fastapi_app():
    return web_app