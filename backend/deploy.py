import paramiko
import os
import time
import requests

def run_deploy():
    host = "172.30.3.206"
    port = 22
    username = "root"
    
    print(f"Connecting to remote server {host}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(host, port=port, username=username, timeout=10)
        print("Connected successfully!")
        
        # 1. Check campaigns in SQLite DB on server
        print("Checking for active campaigns...")
        cmd_running = 'sqlite3 /opt/omni_seo/backend/campaigns.db "SELECT id FROM campaigns WHERE status = \'running\'"'
        stdin, stdout, stderr = ssh.exec_command(cmd_running)
        running_ids = stdout.read().decode('utf-8').strip().split()
        
        if running_ids and running_ids[0]:
            print(f"ERROR: Active campaigns are currently RUNNING on the server (IDs: {running_ids}).")
            print("Cannot deploy while campaign tasks are executing to avoid state corruption.")
            ssh.close()
            return
            
        cmd_monitoring = 'sqlite3 /opt/omni_seo/backend/campaigns.db "SELECT id FROM campaigns WHERE status = \'monitoring\'"'
        stdin, stdout, stderr = ssh.exec_command(cmd_monitoring)
        monitoring_ids = [line.strip() for line in stdout.readlines() if line.strip()]
        
        # 2. Pause monitoring campaigns temporarily
        if monitoring_ids:
            print(f"Found active monitoring campaigns (IDs: {monitoring_ids}). Pausing them temporarily for reload...")
            for mid in monitoring_ids:
                pause_cmd = f'sqlite3 /opt/omni_seo/backend/campaigns.db "UPDATE campaigns SET status = \'paused\' WHERE id = {mid}"'
                ssh.exec_command(pause_cmd)
                # Give database a moment to write
                time.sleep(0.5)
            print("Monitoring campaigns set to paused in DB.")
            
        # 3. Connect SFTP
        print("Opening SFTP channel...")
        sftp = ssh.open_sftp()
        
        # Files list to deploy
        files_to_deploy = [
            ("index.html", "/opt/omni_seo/index.html"),
            ("style.css", "/opt/omni_seo/style.css"),
            ("app.js", "/opt/omni_seo/app.js"),
            ("backend/app.py", "/opt/omni_seo/backend/app.py"),
            ("backend/beyond_seo_engine.py", "/opt/omni_seo/backend/beyond_seo_engine.py"),
            ("backend/init_db.py", "/opt/omni_seo/backend/init_db.py"),
            ("backend/migrate_leads.py", "/opt/omni_seo/backend/migrate_leads.py")
        ]
        
        # Perform uploads
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        for local_rel, remote_abs in files_to_deploy:
            local_abs = os.path.join(base_dir, local_rel)
            print(f"Uploading {local_rel} -> {remote_abs}...")
            sftp.put(local_abs, remote_abs)
            # Set permissions
            sftp.chmod(remote_abs, 0o644)
            
        sftp.close()
        print("All files uploaded successfully.")
        
        # 4. Run database migration on the server
        print("Running database migrations on the server...")
        migrate_cmd = "/opt/omni_seo/backend/venv/bin/python /opt/omni_seo/backend/migrate_leads.py"
        stdin, stdout, stderr = ssh.exec_command(migrate_cmd)
        print("Migration stdout:", stdout.read().decode('utf-8').strip())
        print("Migration stderr:", stderr.read().decode('utf-8').strip())
        
        # 5. Restart Flask service
        print("Restarting systemd service omniseo-backend...")
        restart_cmd = "systemctl restart omniseo-backend"
        stdin, stdout, stderr = ssh.exec_command(restart_cmd)
        print(stdout.read().decode('utf-8').strip())
        errs = stderr.read().decode('utf-8').strip()
        if errs:
            print("Service restart error:", errs)
            
        # Wait for Flask to boot up
        print("Waiting 3 seconds for service boot...")
        time.sleep(3)
        
        # 6. Resume monitoring campaigns
        if monitoring_ids:
            print("Resuming monitoring campaigns...")
            for mid in monitoring_ids:
                # Call resume endpoint on Flask backend locally via SSH to restart monitoring threads cleanly
                resume_endpoint_cmd = f"curl -X POST http://127.0.0.1:8095/api/campaigns/{mid}/resume"
                stdin, stdout, stderr = ssh.exec_command(resume_endpoint_cmd)
                print(f"Resume response for campaign {mid}:", stdout.read().decode('utf-8').strip())
                
        print("Deployment completed successfully!")
        ssh.close()
    except Exception as e:
        print(f"Deployment failed: {e}")

if __name__ == '__main__':
    run_deploy()
