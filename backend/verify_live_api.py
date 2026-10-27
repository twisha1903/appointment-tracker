"""End-to-End Live API Server Verification Script."""
import sys
import time
import subprocess
import httpx

def main():
    print("[1/5] Launching Uvicorn backend server on http://localhost:8000...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=10.0)

    # Wait for server to become responsive
    max_wait = 15
    start_time = time.time()
    server_ready = False
    while time.time() - start_time < max_wait:
        try:
            r = client.get("/api/health")
            if r.status_code == 200:
                server_ready = True
                break
        except Exception:
            time.sleep(0.5)

    if not server_ready:
        proc.terminate()
        stdout, stderr = proc.communicate()
        print(f"FAILED to start uvicorn:\nSTDOUT: {stdout}\nSTDERR: {stderr}")
        sys.exit(1)

    print("Server ready! Beginning live endpoint verifications...")

    results = {}

    try:
        # 1. /api/health
        print("\n--- Verifying GET /api/health ---")
        r_health = client.get("/api/health")
        assert r_health.status_code == 200, f"Expected 200, got {r_health.status_code}"
        data_health = r_health.json()
        print(f"Status: {r_health.status_code} OK")
        print(f"Payload: status={data_health.get('status')}, database={data_health.get('database')}, total_patients={data_health.get('counts', {}).get('total_patients')}")
        results["/api/health"] = r_health.status_code

        # 2. /api/dashboard/summary
        print("\n--- Verifying GET /api/dashboard/summary ---")
        r_dash = client.get("/api/dashboard/summary")
        assert r_dash.status_code == 200, f"Expected 200, got {r_dash.status_code}"
        data_dash = r_dash.json()
        telemetry = data_dash.get("ads_telemetry", {})
        print(f"Status: {r_dash.status_code} OK")
        print(f"ADS Telemetry: Hash Table size={telemetry.get('hash_table', {}).get('size')}, Trie nodes={telemetry.get('trie', {}).get('total_nodes')}, AVL nodes={telemetry.get('avl_tree', {}).get('size')}")
        results["/api/dashboard/summary"] = r_dash.status_code

        # 3. /api/patients/autocomplete?prefix=a
        print("\n--- Verifying GET /api/patients/autocomplete?prefix=a ---")
        r_auto = client.get("/api/patients/autocomplete?prefix=a")
        assert r_auto.status_code == 200, f"Expected 200, got {r_auto.status_code}"
        matches = r_auto.json()
        print(f"Status: {r_auto.status_code} OK")
        print(f"Trie Prefix Matches ({len(matches)} returned): {[m['full_name'] + ' (' + m['patient_id'] + ')' for m in matches[:4]]}")
        results["/api/patients/autocomplete?prefix=a"] = r_auto.status_code

        # 4. /api/appointments
        print("\n--- Verifying GET /api/appointments ---")
        r_apts = client.get("/api/appointments")
        assert r_apts.status_code == 200, f"Expected 200, got {r_apts.status_code}"
        apts = r_apts.json()
        print(f"Status: {r_apts.status_code} OK")
        print(f"Chronological Appointments ({len(apts)} total): First={apts[0]['appointment_id']} at {apts[0]['start_at']}, Last={apts[-1]['appointment_id']} at {apts[-1]['start_at']}")
        results["/api/appointments"] = r_apts.status_code

        # 5. /api/notes/search
        print("\n--- Verifying POST /api/notes/search ---")
        r_kmp = client.post("/api/notes/search", json={"keywords": ["Penicillin", "Latex"]})
        assert r_kmp.status_code == 200, f"Expected 200, got {r_kmp.status_code}"
        kmp_data = r_kmp.json()
        print(f"Status: {r_kmp.status_code} OK")
        print(f"Safety Notice: '{kmp_data.get('safety_notice')}'")
        print(f"Occurrences Found: {kmp_data.get('total_occurrences')}, Patients Matched: {kmp_data.get('total_patients_matched')}")
        results["/api/notes/search"] = r_kmp.status_code

        print("\nAll 5 live endpoints verified successfully against active Uvicorn server!")

    finally:
        client.close()
        proc.terminate()
        proc.wait(timeout=5)
        print("Uvicorn test process terminated cleanly.")

if __name__ == "__main__":
    main()
