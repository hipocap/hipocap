# Hipocap Client Usage Guide

Complete guide to using the Hipocap Python client library for protecting your applications from indirect prompt injection attacks.

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Authentication](#authentication)
4. [Basic Analysis](#basic-analysis)
5. [Advanced Analysis Options](#advanced-analysis-options)
6. [Trace Management](#trace-management)
7. [RBAC Configuration](#rbac-configuration)
8. [Policy Management](#policy-management)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)
11. [Complete Examples](#complete-examples)

## Installation

```bash
pip install -r requirements_client.txt
```

Or install the only dependency directly:

```bash
pip install requests
```

## Quick Start

```python
from hipocap import HipocapClient

# Initialize client
client = HipocapClient(
    server_url="http://localhost:8000",
    api_key="your-api-key-here"
)

# Analyze a function call
result = client.analyze(
    function_name="get_weather",
    function_result={"temperature": 72, "condition": "Sunny"},
    user_query="What's the weather?",
    user_role="user"
)

# Check if safe to use
if result['safe_to_use']:
    print("Safe to display to user")
else:
    print(f"Blocked: {result['reason']}")
```

## Authentication

### Using Environment Variables

```bash
export HIPOCAP_SERVER_URL="http://localhost:8000"
export HIPOCAP_API_KEY="your-api-key-here"
```

```python
from hipocap import HipocapClient

# Client automatically uses environment variables
client = HipocapClient()
```

### Using Direct Configuration

```python
from hipocap import HipocapClient

client = HipocapClient(
    server_url="https://api.example.com",
    api_key="your-api-key-here"
)
```

### Getting Your API Key

1. Start the Hipocap server: `python -m hipocap_v1.api.server`
2. Access the dashboard at `http://localhost:3000`
3. Log in or register
4. Navigate to "API Keys" section
5. Click "Create API Key"
6. **Copy the key immediately** - it's shown only once!

## Basic Analysis

### Simple Analysis

```python
from hipocap import HipocapClient

client = HipocapClient(server_url="http://localhost:8000", api_key="your-key")

result = client.analyze(
    function_name="get_mail",
    function_result={"status": "success", "message": "Email retrieved"},
    user_query="Check my emails",
    user_role="user"
)

print(f"Decision: {result['final_decision']}")
print(f"Safe to Use: {result['safe_to_use']}")
```

### Understanding the Response

```python
result = client.analyze(...)

# Main decision fields
decision = result['final_decision']  # ALLOWED, BLOCKED, REVIEW_REQUIRED, ALLOWED_WITH_WARNING
safe = result['safe_to_use']  # True or False
blocked_at = result.get('blocked_at')  # Stage where blocked (if any)
reason = result.get('reason')  # Explanation

# Analysis details
input_analysis = result.get('input_analysis')  # Stage 1: Prompt Guard results
llm_analysis = result.get('llm_analysis')  # Stage 2: Structured LLM analysis
quarantine_analysis = result.get('quarantine_analysis')  # Stage 3: Quarantine analysis
keyword_detection = result.get('keyword_detection')  # Keyword detection results

# Security checks
rbac_blocked = result.get('rbac_blocked')  # Blocked by RBAC?
chaining_blocked = result.get('chaining_blocked')  # Blocked by function chaining rules?
```

## Advanced Analysis Options

### Full Analysis Pipeline

Enable all analysis stages for maximum security:

```python
result = client.analyze(
    function_name="get_mail",
    function_result=email_data,
    user_query="Check emails",
    user_role="user",
    input_analysis=True,      # Stage 1: Prompt Guard (default: True)
    llm_analysis=True,        # Stage 2: Structured LLM analysis (default: False)
    quarantine_analysis=True, # Stage 3: Quarantine analysis (default: False)
    enable_keyword_detection=True  # Keyword detection (default: False)
)
```

### Fast Analysis (Input Only)

For low-latency requirements, use only input analysis:

```python
result = client.analyze(
    function_name="get_weather",
    function_result=weather_data,
    user_query="What's the weather?",
    user_role="user",
    input_analysis=True,
    llm_analysis=False,
    quarantine_analysis=False
)
```

### Custom Keyword Detection

```python
result = client.analyze(
    function_name="search_web",
    function_result=search_results,
    user_query="Search for information",
    user_role="user",
    enable_keyword_detection=True,
    keywords=["password", "credit card", "SSN", "API key"]  # Custom keywords
)
```

### Using Custom Policies

```python
result = client.analyze(
    function_name="send_mail",
    function_result=mail_data,
    user_query="Send email",
    user_role="developer",
    policy_key="my_custom_policy"  # Use specific policy
)
```

## Trace Management

### List All Traces

```python
# Get all traces
traces = client.list_traces(limit=50, offset=0)
print(f"Total traces: {traces['total']}")

for trace in traces['traces']:
    print(f"Trace {trace['id']}: {trace['final_decision']}")
```

### Filter Traces

```python
# Filter by function name
traces = client.list_traces(
    function_name="get_mail",
    limit=20
)

# Filter by decision
blocked_traces = client.list_traces(
    final_decision="BLOCKED",
    limit=50
)

# Filter by date range
traces = client.list_traces(
    start_date="2024-01-01",
    end_date="2024-01-31",
    limit=100
)
```

### Get Specific Trace

```python
trace = client.get_trace(trace_id=123)
print(f"Decision: {trace['final_decision']}")
print(f"Analysis: {trace['analysis_response']}")
```

### Review Management

```python
# Get traces requiring review
pending_reviews = client.get_review_required_traces(
    status="pending",
    limit=50
)

# Review a trace
for trace in pending_reviews['traces']:
    # Review the trace
    result = client.update_review_status(
        trace_id=trace['id'],
        status="approved",  # or "rejected", "reviewed"
        notes="Content reviewed and approved"
    )
    print(f"Updated: {result['message']}")
```

## RBAC Configuration

### Add a Role

```python
result = client.add_role(
    role_name="developer",
    permissions=["get_mail", "search_web", "summarize_text"],
    description="Developer role with specific permissions"
)
print(f"Added role: {result['message']}")
print(f"Total roles: {result['roles_count']}")
```

### Add Function Permissions

```python
result = client.add_function_permission(
    function_name="custom_function",
    allowed_roles=["developer", "admin"],
    output_restrictions={"max_severity_for_use": "medium"},
    description="Custom function for developers"
)
print(f"Added function: {result['message']}")
```

### Bulk RBAC Update

```python
result = client.update_rbac_config(
    roles={
        "viewer": {
            "permissions": ["get_weather", "search_web"],
            "description": "Viewer role with read-only access"
        },
        "editor": {
            "permissions": ["*"],  # All permissions
            "description": "Editor with full access"
        }
    },
    functions={
        "read_only_function": {
            "allowed_roles": ["viewer", "user"],
            "description": "Read-only function"
        },
        "admin_function": {
            "allowed_roles": ["admin", "editor"],
            "description": "Admin-only function"
        }
    }
)
print(f"Updated: {result['message']}")
print(f"Roles: {result['roles_count']}, Functions: {result['functions_count']}")
```

## Policy Management

Policies are managed through the dashboard, but you can use them in analysis:

```python
# Use default policy (user's default)
result = client.analyze(
    function_name="get_mail",
    function_result=email_data,
    user_query="Check emails",
    user_role="user"
    # policy_key not specified = uses default
)

# Use specific policy
result = client.analyze(
    function_name="send_mail",
    function_result=mail_data,
    user_query="Send email",
    user_role="developer",
    policy_key="production_policy"  # Use production policy
)
```

## Error Handling

### Handling API Errors

```python
from hipocap import HipocapClient, HipocapAPIError, HipocapConnectionError

client = HipocapClient(server_url="http://localhost:8000", api_key="your-key")

try:
    result = client.analyze(
        function_name="get_mail",
        function_result=email_data,
        user_query="Check emails",
        user_role="user"
    )
except HipocapAPIError as e:
    print(f"API Error: {e}")
    print(f"Status Code: {e.status_code}")
    print(f"Response: {e.response}")
    # Handle API error (invalid request, authentication, etc.)
except HipocapConnectionError as e:
    print(f"Connection Error: {e}")
    # Handle connection error (server down, network issue, etc.)
```

### Health Check

```python
try:
    status = client.health_check()
    print(f"Server Status: {status['status']}")
    print(f"Service: {status['service']}")
except HipocapConnectionError as e:
    print(f"Server is not reachable: {e}")
```

## Best Practices

### 1. Always Check `safe_to_use`

```python
result = client.analyze(...)

if not result['safe_to_use']:
    # Block the content
    return {"error": "Content blocked for security reasons"}
    
# Use the content
return result['function_result']
```

### 2. Log Security Events

```python
import logging

result = client.analyze(...)

if result.get('blocked_at'):
    logging.warning(
        f"Security threat detected: {result['reason']}",
        extra={
            "function_name": function_name,
            "blocked_at": result['blocked_at'],
            "decision": result['final_decision']
        }
    )
    # Send to security monitoring system
```

### 3. Handle Errors Gracefully

```python
def safe_analyze(client, function_name, function_result, **kwargs):
    """Safe wrapper that handles errors."""
    try:
        return client.analyze(
            function_name=function_name,
            function_result=function_result,
            **kwargs
        )
    except HipocapAPIError as e:
        logging.error(f"Hipocap API error: {e}")
        # Decide: fail-open (allow) or fail-closed (block)
        # For security, consider failing closed
        return {
            "final_decision": "REVIEW_REQUIRED",
            "safe_to_use": False,
            "reason": "Analysis service unavailable"
        }
    except HipocapConnectionError as e:
        logging.error(f"Hipocap connection error: {e}")
        # Server might be down - decide on policy
        return {
            "final_decision": "REVIEW_REQUIRED",
            "safe_to_use": False,
            "reason": "Analysis service unavailable"
        }
```

### 4. Use Appropriate Analysis Levels

```python
# High-security scenarios: Full analysis
if is_sensitive_function(function_name):
    result = client.analyze(
        ...,
        input_analysis=True,
        llm_analysis=True,
        quarantine_analysis=True,
        enable_keyword_detection=True
    )
# Low-latency scenarios: Fast analysis
else:
    result = client.analyze(
        ...,
        input_analysis=True,
        llm_analysis=False,
        quarantine_analysis=False
    )
```

### 5. Reuse Client Instances

```python
# Good: Reuse client instance
client = HipocapClient(...)
for item in items:
    result = client.analyze(...)

# Bad: Creating new client for each request
for item in items:
    client = HipocapClient(...)  # Inefficient
    result = client.analyze(...)
```

## Complete Examples

### Example 1: Protected Weather API

```python
"""
Example: Protecting a weather API endpoint with Hipocap.
"""

from hipocap import HipocapClient, HipocapAPIError
import requests

# Initialize Hipocap client
hipocap = HipocapClient(
    server_url="http://localhost:8000",
    api_key="your-api-key"
)

def get_weather_protected(location: str, user_role: str = "user"):
    """Get weather data with Hipocap protection."""
    
    # Call weather API
    weather_api_key = "your-weather-api-key"
    response = requests.get(
        f"https://api.weather.com/v1/current",
        params={"location": location, "api_key": weather_api_key}
    )
    weather_data = response.json()
    
    # Analyze with Hipocap
    try:
        result = hipocap.analyze(
            function_name="get_weather",
            function_result=weather_data,
            user_query=f"What's the weather in {location}?",
            user_role=user_role,
            input_analysis=True,
            llm_analysis=True,
            quarantine_analysis=False  # Faster for weather data
        )
        
        if not result['safe_to_use']:
            return {
                "error": "Unable to retrieve weather data",
                "reason": "Security check failed"
            }
        
        return weather_data
        
    except HipocapAPIError as e:
        print(f"Analysis error: {e}")
        # Fail closed for security
        return {
            "error": "Weather service temporarily unavailable"
        }

# Use the protected function
weather = get_weather_protected("San Francisco", user_role="user")
print(weather)
```

### Example 2: Email Processing with Full Analysis

```python
"""
Example: Processing emails with comprehensive security analysis.
"""

from hipocap import HipocapClient

client = HipocapClient(server_url="http://localhost:8000", api_key="your-key")

def process_email(email_data: dict, user_role: str = "user"):
    """Process email with full security analysis."""
    
    result = client.analyze(
        function_name="get_mail",
        function_result=email_data,
        user_query="Check my emails",
        user_role=user_role,
        input_analysis=True,
        llm_analysis=True,           # Enable for email content
        quarantine_analysis=True,    # Enable for email content
        enable_keyword_detection=True,  # Detect sensitive keywords
        keywords=["password", "credit card", "SSN"]  # Custom keywords
    )
    
    # Check decision
    if result['final_decision'] == "BLOCKED":
        return {
            "error": "Email blocked for security reasons",
            "reason": result.get('reason'),
            "blocked_at": result.get('blocked_at')
        }
    
    if result['final_decision'] == "REVIEW_REQUIRED":
        # Log for manual review
        print(f"Email requires review: {result.get('reason')}")
        # Optionally queue for review
        return {
            "status": "pending_review",
            "message": "Email queued for manual review"
        }
    
    # Safe to use
    return {
        "status": "safe",
        "email": email_data,
        "analysis": {
            "input_score": result.get('input_analysis', {}).get('score'),
            "quarantine_score": result.get('quarantine_analysis', {}).get('score')
        }
    }

# Process an email
email = {
    "from": "sender@example.com",
    "subject": "Important Update",
    "body": "Your password reset link: https://example.com/reset"
}

result = process_email(email, user_role="user")
print(result)
```

### Example 3: Batch Processing with Trace Review

```python
"""
Example: Batch processing with automatic review workflow.
"""

from hipocap import HipocapClient

client = HipocapClient(server_url="http://localhost:8000", api_key="your-key")

def process_batch(function_name: str, items: list, user_role: str = "user"):
    """Process multiple items and handle reviews."""
    
    results = []
    
    for item in items:
        # Analyze each item
        result = client.analyze(
            function_name=function_name,
            function_result=item,
            user_query="Batch processing",
            user_role=user_role
        )
        
        if result['final_decision'] == "REVIEW_REQUIRED":
            # Get the trace ID from the response (if available)
            # Note: You may need to query traces to find the latest one
            print(f"Item requires review: {result.get('reason')}")
        
        results.append(result)
    
    return results

def review_pending_items():
    """Review all pending items."""
    
    # Get pending reviews
    pending = client.get_review_required_traces(status="pending", limit=100)
    
    for trace in pending['traces']:
        print(f"\nReviewing trace {trace['id']}")
        print(f"Function: {trace['function_name']}")
        print(f"Decision: {trace['final_decision']}")
        print(f"Reason: {trace.get('reason')}")
        
        # In a real application, you'd show this to a reviewer
        # For this example, we'll auto-approve safe items
        if trace['final_decision'] == "REVIEW_REQUIRED":
            # Review logic here
            review_status = "approved"  # or "rejected"
            
            client.update_review_status(
                trace_id=trace['id'],
                status=review_status,
                notes="Auto-reviewed: Content appears safe"
            )
            print(f"Updated to: {review_status}")

# Process batch
items = [{"data": "item1"}, {"data": "item2"}]
results = process_batch("process_item", items)

# Review pending
review_pending_items()
```

### Example 4: Integration with FastAPI

```python
"""
Example: Integrating Hipocap with a FastAPI application.
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from hipocap import HipocapClient, HipocapAPIError
from typing import Optional

app = FastAPI()

# Initialize Hipocap client (reuse across requests)
hipocap_client = HipocapClient(
    server_url="http://localhost:8000",
    api_key="your-api-key"
)

@app.get("/api/weather/{location}")
async def get_weather(location: str, user_role: str = "user"):
    """Get weather with Hipocap protection."""
    
    # Call weather API
    weather_data = fetch_weather(location)
    
    # Analyze with Hipocap
    try:
        result = hipocap_client.analyze(
            function_name="get_weather",
            function_result=weather_data,
            user_query=f"What's the weather in {location}?",
            user_role=user_role
        )
        
        if not result['safe_to_use']:
            raise HTTPException(
                status_code=403,
                detail=f"Weather data blocked: {result.get('reason')}"
            )
        
        return weather_data
        
    except HipocapAPIError as e:
        raise HTTPException(
            status_code=503,
            detail="Security analysis service unavailable"
        )

@app.get("/api/traces")
async def list_traces(
    limit: int = 50,
    offset: int = 0,
    final_decision: Optional[str] = None
):
    """List analysis traces."""
    try:
        traces = hipocap_client.list_traces(
            limit=limit,
            offset=offset,
            final_decision=final_decision
        )
        return traces
    except HipocapAPIError as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Example 5: Monitoring and Alerting

```python
"""
Example: Setting up monitoring and alerting for security events.
"""

from hipocap import HipocapClient
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = HipocapClient(server_url="http://localhost:8000", api_key="your-key")

def analyze_with_monitoring(function_name: str, function_result: dict, **kwargs):
    """Analyze with monitoring and alerting."""
    
    result = client.analyze(
        function_name=function_name,
        function_result=function_result,
        **kwargs
    )
    
    # Monitor blocked requests
    if result['final_decision'] == "BLOCKED":
        logger.warning(
            f"SECURITY ALERT: Request blocked",
            extra={
                "function_name": function_name,
                "blocked_at": result.get('blocked_at'),
                "reason": result.get('reason'),
                "timestamp": datetime.now().isoformat()
            }
        )
        # Send to security monitoring system
        send_security_alert(result)
    
    # Monitor review-required requests
    if result['final_decision'] == "REVIEW_REQUIRED":
        logger.info(
            f"Review required: {function_name}",
            extra={
                "function_name": function_name,
                "reason": result.get('reason'),
                "timestamp": datetime.now().isoformat()
            }
        )
        # Queue for review
        queue_for_review(result)
    
    return result

def send_security_alert(result: dict):
    """Send security alert to monitoring system."""
    # Integrate with your monitoring system (e.g., Sentry, Datadog, etc.)
    pass

def queue_for_review(result: dict):
    """Queue item for manual review."""
    # Add to review queue
    pass

# Use with monitoring
result = analyze_with_monitoring(
    function_name="get_mail",
    function_result={"content": "suspicious content"},
    user_query="Check emails",
    user_role="user"
)
```

## API Reference Summary

### HipocapClient Methods

- `analyze()` - Analyze function calls for security threats
- `health_check()` - Check server health
- `list_traces()` - List analysis traces
- `get_trace()` - Get specific trace
- `get_review_required_traces()` - Get traces requiring review
- `update_review_status()` - Update trace review status
- `add_role()` - Add RBAC role
- `add_function_permission()` - Add function permission
- `update_rbac_config()` - Bulk RBAC update
- `close()` - Close client connection

### Analysis Response Fields

- `final_decision` - ALLOWED, BLOCKED, REVIEW_REQUIRED, ALLOWED_WITH_WARNING
- `safe_to_use` - Boolean indicating safety
- `blocked_at` - Stage where blocked (if any)
- `reason` - Explanation of decision
- `input_analysis` - Stage 1 analysis results
- `llm_analysis` - Stage 2 analysis results
- `quarantine_analysis` - Stage 3 analysis results
- `keyword_detection` - Keyword detection results
- `rbac_blocked` - RBAC blocking status
- `chaining_blocked` - Function chaining blocking status

## Troubleshooting

### Connection Errors

**Problem**: `HipocapConnectionError: Failed to connect to server`

**Solutions**:
1. Verify server is running: `python -m hipocap_v1.api.server`
2. Check server URL is correct
3. Check firewall/network settings
4. Test with: `curl http://localhost:8000/api/v1/health`

### Authentication Errors

**Problem**: `HipocapAPIError: 401 Unauthorized`

**Solutions**:
1. Verify API key is correct
2. Check API key hasn't been revoked
3. Ensure API key is active
4. Check Authorization header format: `Bearer <key>`

### Analysis Timeout

**Problem**: Requests timeout

**Solutions**:
1. Increase timeout: `HipocapClient(..., timeout=60)`
2. Use faster analysis: `quarantine_analysis=False`
3. Check server performance

## Next Steps

- Configure policies in the dashboard
- Set up RBAC rules for your application
- Review analysis traces regularly
- Set up monitoring and alerting
- Review [Architecture Documentation](ARCHITECTURE.md)
- Check [Model Behavior Guide](MODEL_BEHAVIOR.md)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs for detailed error messages
3. Check the API documentation at `http://localhost:8000/docs`
4. Review example files in the `examples/` directory

