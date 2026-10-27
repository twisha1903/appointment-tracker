import pytest
from fastapi.testclient import TestClient
from app.main import app


def test_smoke():
    """Verify that test runner works properly."""
    assert 1 + 1 == 2


def test_health_endpoints():
    """Verify root and health check endpoints."""
    client = TestClient(app)
    
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "CareTrack" in data["service"]

    response_health = client.get("/health")
    assert response_health.status_code == 200
    assert response_health.json() == {"status": "ok"}
