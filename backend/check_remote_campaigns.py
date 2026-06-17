import paramiko
import sys

def check_status():
    host = "172.30.3.206"
    port = 22
    username = "root"
    
    print(f"Connecting to remote server {host}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(host, port=port, username=username, timeout=10)
        print("Connected! Querying campaigns status...")
        
        cmd = 'sqlite3 /opt/omni_seo/backend/campaigns.db "SELECT id, domain, status, progress FROM campaigns WHERE status IN (\'running\', \'monitoring\')"'
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        output = stdout.read().decode('utf-8').strip()
        errors = stderr.read().decode('utf-8').strip()
        
        if errors:
            print(f"Remote command execution warning/error: {errors}")
            
        if not output:
            print("No campaigns are currently in 'running' or 'monitoring' states on the production server. Safe to deploy!")
            sys.exit(0)
        else:
            print("WARNING: Active campaigns detected on production server:")
            print(output)
            print("Please wait for active campaigns to finish, or pause them before restarting.")
            sys.exit(1)
            
        ssh.close()
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(2)

if __name__ == '__main__':
    check_status()
