def get_user_id(token: str) -> str:
    return token.split(".")[0]
