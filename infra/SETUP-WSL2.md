# WSL2 + Docker Engine Setup (one-time)

No Docker Desktop required. Everything runs inside WSL2 using Docker Engine.

## 1. Install WSL2 + Ubuntu

In PowerShell (admin):

```powershell
wsl --install -d Ubuntu
```

Restart when prompted. Then set a Unix username + password inside Ubuntu.

## 2. Install Docker Engine inside WSL2

Inside the Ubuntu WSL2 distro:

```bash
# Remove any old Docker packages
sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Add Docker's official apt repo
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

## 3. Enable Docker service and add your user

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and back in (or: newgrp docker)
```

## 4. Verify

```bash
docker run --rm hello-world
docker compose version
```

Both commands should succeed with no `sudo`.

## 5. Install pnpm (optional — everything also works inside containers)

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
# Restart shell, then:
pnpm --version
```

## 6. Clone the repo and start

```bash
git clone https://github.com/mg-gouda/iTourCarRental.git
cd iTourCarRental
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, SESSION_SECRET, AUTH_SECRET at minimum
pnpm dev:up
```
