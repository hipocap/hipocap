# Hipocap Client Update Summary

This document summarizes the updates made to the Hipocap client to align with the latest server changes.

## Key Changes

### 1. Authentication

**Before:**
- Used `X-API-Key` header (if implemented)

**After:**
- Uses `Authorization: Bearer <api-key>` header format
- Matches FastAPI HTTPBearer authentication standard

### 2. Analysis Parameters

**Before:**
```python
client.analyze(
    function_name="...",
    function_result={...},
    require_quarantine=True  # Old parameter
)
```

**After:**
```python
client.analyze(
    function_name="...",
    function_result={...},
    input_analysis=True,      # New: Stage 1 (default: True)
    llm_analysis=False,        # New: Stage 2 (default: False)
    quarantine_analysis=False, # New: Stage 3 (default: False)
    enable_keyword_detection=False,  # New: Keyword detection
    keywords=None              # New: Custom keywords list
)
```

### 3. New Trace Management Methods

Added methods for managing analysis traces:

- `list_traces()` - List all traces with filtering
- `get_trace(trace_id)` - Get specific trace
- `get_review_required_traces()` - Get traces requiring review
- `update_review_status()` - Update review status

### 4. Response Fields

**New fields in analysis response:**
- `keyword_detection` - Keyword detection results (if enabled)

**Existing fields (unchanged):**
- `final_decision`
- `safe_to_use`
- `blocked_at`
- `reason`
- `input_analysis`
- `quarantine_analysis`
- `llm_analysis`
- `rbac_blocked`
- `chaining_blocked`

## Migration Guide

### Updating Existing Code

#### Old Code:
```python
result = client.analyze(
    function_name="get_mail",
    function_result=email_data,
    user_query="Check emails",
    user_role="user",
    require_quarantine=True
)
```

#### New Code:
```python
result = client.analyze(
    function_name="get_mail",
    function_result=email_data,
    user_query="Check emails",
    user_role="user",
    quarantine_analysis=True  # Changed from require_quarantine
)
```

### Backward Compatibility

The client maintains backward compatibility for basic usage:
- `input_analysis` defaults to `True` (same as before)
- `quarantine_analysis` defaults to `False` (was `require_quarantine=True` by default)

**Note:** If you were using `require_quarantine=False`, you should now use `quarantine_analysis=False`.

## New Features

### 1. Trace Management

```python
# List all traces
traces = client.list_traces(limit=50)

# Filter traces
blocked = client.list_traces(final_decision="BLOCKED")

# Get specific trace
trace = client.get_trace(123)

# Review management
pending = client.get_review_required_traces(status="pending")
client.update_review_status(trace_id=123, status="approved")
```

### 2. Advanced Analysis Options

```python
# Full analysis pipeline
result = client.analyze(
    ...,
    input_analysis=True,
    llm_analysis=True,
    quarantine_analysis=True,
    enable_keyword_detection=True
)

# Fast analysis (input only)
result = client.analyze(
    ...,
    input_analysis=True,
    llm_analysis=False,
    quarantine_analysis=False
)
```

### 3. Custom Keyword Detection

```python
result = client.analyze(
    ...,
    enable_keyword_detection=True,
    keywords=["password", "credit card", "SSN"]
)
```

## API Endpoints

### New Endpoints

- `GET /api/v1/traces` - List traces
- `GET /api/v1/traces/{trace_id}` - Get specific trace
- `GET /api/v1/traces/review-required` - Get review-required traces
- `POST /api/v1/traces/{trace_id}/review` - Update review status

### Updated Endpoints

- `POST /api/v1/analyze` - Now accepts new analysis parameters

## Documentation

- **[Client Usage Guide](CLIENT_USAGE_GUIDE.md)** - Comprehensive guide with examples
- **[Updated Client Example](examples/updated_client_example.py)** - Full working example
- **[README_CLIENT.md](../README_CLIENT.md)** - Quick reference

## Testing

Test your updated code:

```python
from hipocap import HipocapClient

client = HipocapClient(
    server_url="http://localhost:8000",
    api_key="your-api-key"
)

# Test basic analysis
result = client.analyze(
    function_name="test",
    function_result={"data": "test"},
    user_query="test",
    user_role="user"
)
assert 'final_decision' in result
assert 'safe_to_use' in result

# Test trace management
traces = client.list_traces(limit=1)
assert 'traces' in traces
assert 'total' in traces
```

## Breaking Changes

1. **`require_quarantine` parameter removed** - Use `quarantine_analysis` instead
2. **Authentication header format** - Now uses `Bearer` token (automatic in client)

## Questions?

- Check [Client Usage Guide](CLIENT_USAGE_GUIDE.md) for detailed examples
- Review [API Quick Start](API_QUICK_START.md) for integration patterns
- See [examples/updated_client_example.py](../examples/updated_client_example.py) for working code






