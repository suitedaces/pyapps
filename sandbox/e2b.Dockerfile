FROM python:3.11-slim

# System dependencies
RUN apt-get update && \
    apt-get install -y s3fs fuse gcc && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Python data science packages
RUN pip3 install --no-cache-dir \
    streamlit pandas numpy matplotlib seaborn plotly \
    scikit-learn statsmodels scikit-learn xgboost streamlit-extras prophet yfinance spotipy PyPDF2[crypto] ta fredapi

# Configure FUSE and mount point
RUN sed -i 's/#user_allow_other/user_allow_other/' /etc/fuse.conf && \
    mkdir -p /app/s3 && \
    chmod -R 777 /app

ENV STREAMLIT_USAGE_STATS=False

WORKDIR /app