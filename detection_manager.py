#!/usr/bin/env python3
import subprocess
import threading
import json
import os
import time
from pathlib import Path
import queue
import uuid

class DetectionManager:
    def __init__(self):
        self.jobs = {}  # job_id: job_info
        self.progress_queues = {}  # job_id: queue for SSE
        
    def start_detection(self, code, params=None):
        """Start a new detection job"""
        job_id = str(uuid.uuid4())
        
        # Default parameters
        default_params = {
            'hertz': 2,
            'confidence': 0.75,
            'duration': 3600 * 10, # Max duration of 10 hours
            'batch_size': 1
        }
        # Merge user params with defaults
        params = {**default_params, **(params or {})}
        
        # Create progress queue
        self.progress_queues[job_id] = queue.Queue()
        
        # Start detection in thread
        thread = threading.Thread(
            target=self._run_detection,
            args=(job_id, code, params)
        )
        thread.daemon = True
        thread.start()
        
        # Store job info
        self.jobs[job_id] = {
            'id': job_id,
            'code': code,
            'status': 'running',
            'thread': thread,
            'start_time': time.time(),
            'params': params
        }
        
        return job_id
    
    def _run_detection(self, job_id, code, params):
        """Run detection subprocess and capture output"""
        try:
            cmd = [
                'python', 'detect_with_yolo.py',
                code,  # Will be interpreted as 4-digit code
                '--hertz', str(params['hertz']),
                '--confidence', str(params['confidence']),
                '--duration', str(params['duration']),
                '--batch-size', str(params['batch_size']),
                '--progress-json'  # New flag for JSON progress output
            ]
            
            # Add mirror flag if specified
            if params.get('is_mirror'):
                cmd.append('--mirror')
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            self.jobs[job_id]['process'] = process
            
            # Read output line by line
            for line in process.stdout:
                line = line.strip()
                if line.startswith('PROGRESS:'):
                    # Parse JSON progress update
                    try:
                        progress_data = json.loads(line[9:])
                        self.progress_queues[job_id].put(progress_data)
                    except json.JSONDecodeError:
                        pass
            
            # Wait for process to complete
            process.wait()
            
            # Update job status
            if process.returncode == 0:
                self.jobs[job_id]['status'] = 'completed'
                self.progress_queues[job_id].put({
                    'type': 'complete',
                    'message': 'Detection completed successfully'
                })
            else:
                self.jobs[job_id]['status'] = 'failed'
                self.progress_queues[job_id].put({
                    'type': 'error',
                    'message': f'Detection failed with code {process.returncode}'
                })
                
        except Exception as e:
            self.jobs[job_id]['status'] = 'failed'
            self.progress_queues[job_id].put({
                'type': 'error',
                'message': str(e)
            })
    
    def get_progress_queue(self, job_id):
        """Get progress queue for a job"""
        return self.progress_queues.get(job_id)
    
    def cancel_job(self, job_id):
        """Cancel a running job"""
        if job_id in self.jobs:
            job = self.jobs[job_id]
            if 'process' in job and job['process'].poll() is None:
                job['process'].terminate()
                job['status'] = 'cancelled'
                return True
        return False
    
    def get_job_status(self, job_id):
        """Get status of a job"""
        if job_id in self.jobs:
            return self.jobs[job_id]['status']
        return None

# Global instance
detection_manager = DetectionManager()