"""Disposable real-PTY check. No password in arguments, environment or output."""
import json
import os
from pathlib import Path
import pty
import secrets
import select
import subprocess
import termios
import time

master, slave = pty.openpty()
before = termios.tcgetattr(slave)
module = str(Path(__file__).resolve().parents[2] / "lib")
script = (
    "require(" + json.dumps(module) + ").promptPassword()"
    ".then(value=>{value.fill(0);console.log('KB01B_TTY_OK')})"
    ".catch(()=>process.exit(1))"
)
child = subprocess.Popen(["node", "-e", script], stdin=slave, stdout=slave, stderr=slave)
secret = secrets.token_urlsafe(24).encode()
output = b""
first = second = False
try:
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        readable, _, _ = select.select([master], [], [], 0.2)
        if readable:
            try:
                output += os.read(master, 8192)
            except OSError:
                break
            if b"Initial Drumee password:" in output and not first:
                os.write(master, secret + b"\r")
                first = True
            if b"Confirm password:" in output and not second:
                os.write(master, secret + b"\r")
                second = True
        if child.poll() is not None:
            break
    child.wait(timeout=2)
    assert child.returncode == 0 and b"KB01B_TTY_OK" in output and secret not in output
    after = termios.tcgetattr(slave)
    assert bool(after[3] & termios.ECHO) == bool(before[3] & termios.ECHO)
    print("KB01B_REAL_PTY_NO_ECHO_CONFIRMED")
finally:
    if child.poll() is None:
        child.kill()
        child.wait()
    os.close(master)
    os.close(slave)
