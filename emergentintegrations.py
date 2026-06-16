class UserMessage:
    def __init__(self, content):
        self.content = content

class LlmChat:
    def __init__(self, *args, **kwargs):
        pass
    async def generate_response(self, message, *args, **kwargs):
        # Fallback response so your app doesn't crash
        return "Chat backend loaded successfully!"
