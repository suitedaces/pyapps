FROM python:3.9-slim

# System dependencies
RUN apt-get update && apt-get install -y \
    s3fs \
    fuse \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Python data science packages
RUN pip3 install --no-cache-dir \
    streamlit pandas numpy matplotlib seaborn plotly \
    scikit-learn statsmodels scikit-learn xgboost streamlit-extras prophet yfinance spotipy PyPDF2[crypto] ta

# Configure FUSE and mount point
RUN sed -i 's/#user_allow_other/user_allow_other/' /etc/fuse.conf && \
    mkdir -p /app/s3 && \
    chmod -R 777 /app

WORKDIR /app