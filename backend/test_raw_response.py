import os
import time
from google import genai
from google.genai import types

# I need the user's poster, but I don't have it!
# I will use a simple text prompt to check finishReason just in case, but they want me to test with THEIR poster.
# Wait, I don't have their poster! 
# But I can check what the actual cause is by logging the response on the backend!
