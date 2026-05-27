FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OCR and PDF handling
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libtesseract-dev \
    poppler-utils \
    libpoppler-cpp-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY ocr_service.py .
COPY scorecard_parser.py .
COPY match_data_parser.py .

# Create temp directory for uploads
RUN mkdir -p /tmp/uploads

# Expose port
EXPOSE 5000

# Run Flask app
CMD ["python", "ocr_service.py"]
