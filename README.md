<p align="center">
  <picture>
    <img alt="HipoCap logo" src="./images/logo.png" width="180" height="190">
  </picture>
  <br>
  <strong>HipoCap</strong>
</p>

<p align="center">
  <a href="https://x.com/hipocap">
    <img alt="X (formerly Twitter) Follow" src="https://img.shields.io/twitter/follow/hipocap" />
  </a>
</p>

[HipoCap](https://hipocap.com) is an AI security and observability platform that protects your LLM applications from prompt injection attacks while providing comprehensive observability.

- [x] 🛡️ **AI Security** - Multi-stage defense pipeline
    - [x] **Prompt Guard** - Fast input analysis using specialized models to detect prompt injection attempts
    - [x] **LLM Analysis** - Deep structured analysis of function calls and results
    - [x] **Quarantine Analysis** - Two-stage infection simulation to detect sophisticated attacks
    - [x] **Threat Detection** - 14 threat categories (S1-S14) covering all major attack vectors
    - [x] **Custom Shields** - Prompt-based blocking rules for direct prompt injection detection
- [x] 🔐 **Governance & RBAC** - Role-based access control
    - [x] Function-level permissions and access control
    - [x] Policy-driven security rules
    - [x] Function chaining rules to prevent unauthorized sequences
    - [x] User role management and audit trails
- [x] 📊 **Observability** - OpenTelemetry-native tracing
    - [x] Automatic instrumentation for **OpenAI, Anthropic, LangChain, and more**
    - [x] Real-time trace viewing with security analysis integration
    - [x] SQL access to all trace data
    - [x] Custom dashboards and metrics
    - [x] Evaluations framework for testing and validation

## Demo

<p align="center">
  <img alt="HipoCap demo screenshot" src="./images/demo.png" width="700">
</p>

## Quick Start (5 minutes)

Get HipoCap running locally in minutes.

### Prerequisites

- Docker and Docker Compose installed
- Git

### Step 1: Clone and Setup

```bash
git clone https://github.com/hipocap/hipocap
cd hipocap
```

### Step 2: Create Environment File

Create a `.env` file in the project root with minimal required variables:

**Linux/Mac:**
```bash
cat > .env << 'EOF'
# Database (required)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
HIPOCAP_DB_NAME=hipocap_second

# ClickHouse (required)
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=clickhouse_password

# Security tokens (required - generate random strings)
SHARED_SECRET_TOKEN=$(openssl rand -hex 32)
AEAD_SECRET_KEY=$(openssl rand -hex 32)
HIPOCAP_API_KEY=$(openssl rand -hex 16)
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# LLM Configuration (optional - for security analysis)
OPENAI_API_KEY=your-openai-key-here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=gpt-4o-mini
EOF
```

**Windows (PowerShell):**
```powershell
@"
# Database (required)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
HIPOCAP_DB_NAME=hipocap_second

# ClickHouse (required)
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=clickhouse_password

# Security tokens (required - replace with random strings)
SHARED_SECRET_TOKEN=replace-with-random-32-char-string
AEAD_SECRET_KEY=replace-with-random-32-char-string
HIPOCAP_API_KEY=replace-with-random-16-char-string
NEXTAUTH_SECRET=replace-with-random-32-char-string

# LLM Configuration (optional - for security analysis)
OPENAI_API_KEY=your-openai-key-here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=gpt-4o-mini
"@ | Out-File -FilePath .env -Encoding utf8
```

**Or use the example file:**
```bash
# If .env.example exists
cp .env.example .env
# Then edit .env and replace placeholder values
```

### Step 3: Start Services

```bash
docker compose -f docker-compose.yml up -d
```

This starts all services:
- **Frontend** → http://localhost:3000
- **HipoCap Server** → http://localhost:8006
- **Observability Backend** → http://localhost:8000
- **PostgreSQL** → localhost:5433
- **ClickHouse** → localhost:8123
- **Quickwit** → http://localhost:7280

### Step 4: Access the Dashboard

Open your browser and go to **http://localhost:3000**

You'll be prompted to sign up and create an account. Once logged in, you can:
- View traces and observability data
- Configure security policies
- Set up API keys for your applications

### Creating Your First Policy

After logging in, navigate to the **Policies** section to create your first security policy:

1. **Access Policies**: Click on "Policies" in the sidebar under the "Monitoring" section, or navigate to `/project/[your-project-id]/policies`
2. **Create Policy**: Click the "Create Policy" button to open the policy creation form
3. **Configure Policy**: Set up your policy with:
   - **Policy Key**: A unique identifier (e.g., `default`, `strict`, `permissive`)
   - **Roles**: Define user roles and their permissions
   - **Functions**: Specify which functions are allowed/blocked
   - **Severity Rules**: Configure threat detection thresholds
   - **Function Chaining**: Set rules for function call sequences
   - **Output Restrictions**: Control what data can be returned
   - **Prompts**: You can add custom prompts for LLM and Quarantine Analysis.

![Policy Creation Example](./images/create_policy.png)
![Policy Editing Example](./images/edit_policy.png)

> **Note**: You'll need to create at least one policy before using HipoCap's security analysis features. The policy key you create will be referenced in your code when calling `client.analyze()`.

### Creating Your First Shield

**Shields** are prompt-based blocking rules designed specifically for **Direct Prompt Injection** detection. They allow you to define custom rules for what to block and what not to block based on prompt descriptions.

1. **Access Shields**: Click on "Shields" in the sidebar under the "Monitoring" section, or navigate to `/project/[your-project-id]/shields`
2. **Create Shield**: Click the "Create Shield" button to open the shield creation form
3. **Configure Shield**: Set up your shield with:
   - **Shield Key**: A unique identifier (e.g., `jailbreak`, `data-extraction`, `system-prompt-leak`)
   - **Name**: A human-readable name for the shield
   - **Description**: Optional description of the shield's purpose
   - **Prompt Description**: Description of the type of prompts this shield should analyze
   - **What to Block**: Detailed description of content patterns to block
   - **What Not to Block**: Exceptions or content that should be allowed

![Shield Creation Example](./images/create_shield.png)

> **Note**: Shields are optimized for direct prompt injection scenarios where you need to analyze user input before it reaches your LLM. The shield key you create will be referenced in your code when calling `client.shield()`.

### Step 5: Check Service Status

```bash
# View all services
docker compose -f docker-compose.yml ps

# View logs
docker compose -f docker-compose.yml logs -f

# Stop services
docker compose -f docker-compose.yml down
```

## Python Integration

### Install HipoCap SDK

```bash
pip install 'hipocap[all]'
```

This installs the HipoCap Python SDK and all instrumentation packages.

### Basic Example

```python
import os
from hipocap import Hipocap, observe
from openai import OpenAI

# Initialize HipoCap
client = Hipocap.initialize(
    project_api_key=os.environ.get("HIPOCAP_API_KEY"),
    base_url="http://localhost",      # Observability server
    http_port=8000,
    grpc_port=8001,
    hipocap_base_url="http://localhost:8006",  # Security server
    hipocap_user_id=os.environ.get("HIPOCAP_USER_ID")
)

# OpenAI client (automatically instrumented)
openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

@observe()  # This function will be traced
def get_user_data(user_id: str):
    """Retrieve user data - automatically traced."""
    return {"user_id": user_id, "email": f"user{user_id}@example.com"}

@observe()
def process_user_request():
    user_query = "What's my email?"
    user_id = "123"
    
    # Execute function
    user_data = get_user_data(user_id)
    
    # Analyze for security threats
    result = client.analyze(
        function_name="get_user_data",
        function_result=user_data,
        function_args={"user_id": user_id},
        user_query=user_query,
        user_role="user",
        input_analysis=True,   # Stage 1: Prompt Guard
        llm_analysis=True,     # Stage 2: LLM Analysis
        policy_key="default"
    )
    
    # Only return if safe
    if not result.get("safe_to_use"):
        return {"error": "Blocked by security policy", "reason": result.get("reason")}
    
    return user_data

result = process_user_request()
print(result)

```

### Shield Example (Direct Prompt Injection Detection)

**Shields** are designed specifically for **Direct Prompt Injection** detection. They allow you to analyze any text content (user input, emails, documents, etc.) before it reaches your LLM:

```python
from hipocap import Hipocap

client = Hipocap.initialize(
    project_api_key="your-api-key-here",
    base_url="http://localhost",      # Observability server
    http_port=8000,
    grpc_port=8001,
    hipocap_base_url="http://localhost:8006",  # Security server
    hipocap_user_id="your-user-id-here"
)

# Interactive shield analysis
while True:
    content = input("Enter content to analyze: ")
    result = client.shield(
        shield_key="jailbreak",
        content=content
    )
    print(result["decision"])  # "BLOCK" or "ALLOW"
    print(result.get("reason"))  # Optional reason if require_reason=True
```

**Shield Features:**
- Analyze any text input (not just function calls)
- Custom blocking rules per shield
- Fast decision-making for real-time protection
- Optional reasoning for blocked content

> **Note**: Create your shields in the dashboard first (see "Creating Your First Shield" above). Shields are ideal for protecting against direct prompt injection attacks where malicious instructions are embedded in user input.

### Environment Variables for Python

```bash
export HIPOCAP_API_KEY=your-api-key-from-dashboard
export HIPOCAP_USER_ID=your-user-id-from-dashboard
export OPENAI_API_KEY=your-openai-key
```

Get your API key from the HipoCap dashboard at http://localhost:3000 after signing up.

## Production Deployment

For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

**Quick production commands:**
```bash
# Build and push images
.\scripts\build-and-push.ps1 -VersionTag v1.0.0  # Windows
./scripts/build-and-push.sh v1.0.0                # Linux/Mac

# Deploy
docker compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Services won't start

1. **Check Docker is running:**
   ```bash
   docker info
   ```

2. **Check ports are available:**
   ```bash
   # Linux/Mac
   lsof -i :3000
   
   # Windows
   netstat -ano | findstr :3000
   ```

3. **View service logs:**
   ```bash
   docker compose -f docker-compose.yml logs frontend
   docker compose -f docker-compose.yml logs hipocap-server
   ```

### Frontend shows connection errors

- Ensure all services are running: `docker compose -f docker-compose.yml ps`
- Check that environment variables are set correctly
- Verify services are healthy: `docker compose -f docker-compose.yml ps`

### Database connection issues

- Wait for postgres to be healthy (may take 30-60 seconds on first start)
- Check postgres logs: `docker compose -f docker-compose.yml logs postgres`
- Verify `POSTGRES_PASSWORD` matches in your `.env` file

### Can't access dashboard

- Ensure frontend is running: `docker compose -f docker-compose.yml ps frontend`
- Check frontend logs: `docker compose -f docker-compose.yml logs frontend`
- Try accessing http://localhost:3000 directly
- Check if port 3000 is already in use

## Next Steps

- **Create Your First Policy**: Navigate to the Policies section in the dashboard (under "Monitoring" in the sidebar) at http://localhost:3000/project/[your-project-id]/policies. This is required before using security analysis features.
- **Configure Security Policies**: Set up policies with roles, functions, severity rules, and function chaining restrictions
- **Integrate with Your App**: Follow the Python integration guide above and reference your policy key in `client.analyze()`
- **View Traces**: Check the traces section in the dashboard to see security analysis results
- **Read Documentation**: See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup

## Documentation

- [Contributing Guide](CONTRIBUTING.md) - Development setup and contributing
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Full Documentation](https://hipocap.com) - Complete API and feature docs

## Client Library

 <a href="https://pypi.org/project/hipocap/"> ![PyPI - Version](https://img.shields.io/pypi/v/hipocap?label=hipocap&logo=pypi&logoColor=3775A9) </a>
![PyPI - Downloads](https://img.shields.io/pypi/dm/hipocap)
![PyPI - Python Version](https://img.shields.io/pypi/pyversions/hipocap)

## Support

- **Issues**: [GitHub Issues](https://github.com/hipocap/hipocap/issues)
- **Documentation**: [hipocap.com](https://hipocap.com)
- **Twitter**: [@hipocap](https://x.com/hipocap)
