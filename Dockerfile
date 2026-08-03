FROM python:3.11-slim

WORKDIR /app

# Install system deps for python-pptx and python-docx
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-common \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
