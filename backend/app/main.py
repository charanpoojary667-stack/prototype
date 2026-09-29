"""FastAPI application entry point."""

from fastapi import FastAPI

from backend.app.judging_routes import router as judging_router


app = FastAPI(title="DOGFOOD Judging Platform")
app.include_router(judging_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Report that the API process is running."""

    return {"status": "ok"}
