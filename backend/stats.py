from multipass import get_all_instances_info, is_daemon_running


def get_stats() -> dict:
    daemon_ok = is_daemon_running()
    ok, instances, _ = get_all_instances_info()

    total = len(instances)
    running = sum(1 for i in instances if i.get("state") == "Running")
    stopped = sum(1 for i in instances if i.get("state") == "Stopped")
    suspended = sum(1 for i in instances if i.get("state") == "Suspended")

    total_cpus = sum(int(i.get("cpus") or 0) for i in instances)
    total_ram_used = sum(i.get("memory", {}).get("used", 0) for i in instances)
    total_ram = sum(i.get("memory", {}).get("total", 0) for i in instances)
    total_disk_used = sum(i.get("disk", {}).get("used", 0) for i in instances)
    total_disk = sum(i.get("disk", {}).get("total", 0) for i in instances)

    return {
        "daemon_running": daemon_ok,
        "total": total,
        "running": running,
        "stopped": stopped,
        "suspended": suspended,
        "total_cpus": total_cpus,
        "total_ram_used": total_ram_used,
        "total_ram": total_ram,
        "total_disk_used": total_disk_used,
        "total_disk": total_disk,
    }
