from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, posts, users, extras, ai

app = FastAPI(title="BearBoard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(users.router)
app.include_router(extras.router)
app.include_router(ai.router)


@app.get("/")
def root():
    return {"message": "BearBoard API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
