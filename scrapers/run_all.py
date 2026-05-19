"""
Run every scraper, print a per-site summary, optionally write to a JSON snapshot.

Usage:
  python -m scrapers.run_all                       # stdout only
  python -m scrapers.run_all --out src/data/notices.json   # also write JSON

Phase 2 will replace `--out` with a SupabaseSink that pushes to the `notices` table.
"""
from __future__ import annotations

import argparse
import importlib
import os
import sys
import time
import urllib3
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from scrapers.base import (
    StdoutSink,
    JsonFileSink,
    SupabaseSink,
    polite_sleep,
    load_overrides_from_supabase,
)
from scrapers._v2_allowlist import V2_ALLOWLIST, norm as v2_norm


def _build_v2_meta() -> dict[str, tuple[str, str, str]]:
    """Map normalized v2 url -> (region, sub_entity, source_page).
    Reads src/data/regions.json so v2's xlsx-derived labels are the
    single source of truth, overriding any divergent labels in the
    individual scraper SourceMeta definitions."""
    import json
    from pathlib import Path
    p = Path(__file__).resolve().parent.parent / "src" / "data" / "regions.json"
    out: dict[str, tuple[str, str, str]] = {}
    for r in json.loads(p.read_text(encoding="utf-8")):
        for sub in r.get("subEntities", []):
            for s in sub.get("sources", []):
                u = s.get("url")
                if u:
                    out[v2_norm(u)] = (r["region"], sub["name"], s.get("page", ""))
    return out


V2_META = _build_v2_meta()

# Register scrapers here. Each entry is the dotted module path; the module
# must expose `SOURCE: SourceMeta` and `scrape() -> list[Notice]`.
SCRAPERS = [
    # 충청남도
    "scrapers.chungcheongnam.asan",
    "scrapers.chungcheongnam.chungnam_batch",
    "scrapers.chungcheongnam.chungnam_eminwon",
    "scrapers.chungcheongnam.chungnam_sap",
    "scrapers.chungcheongnam.cheonan_si",
    # 충청북도
    "scrapers.chungcheongbuk.chungbuk_batch",
    "scrapers.chungcheongbuk.chungbuk_web_batch",
    "scrapers.chungcheongbuk.cheongju_eminwon",
    # 경기도
    "scrapers.gyeonggi.gyeonggi_batch",
    "scrapers.gyeonggi.gyeonggi_pw_batch",
    "scrapers.gyeonggi.hscity",
    "scrapers.gyeonggi.pyeongtaek_si",
    "scrapers.gyeonggi.anseong_si",
    "scrapers.gyeonggi.ansan_si",
    "scrapers.gyeonggi.uiwang_si",
    "scrapers.gyeonggi.seongnam_si",
    "scrapers.gyeonggi.goyang_si",
    "scrapers.gyeonggi.newtech_gg",
    "scrapers.gyeonggi.calspia",
    "scrapers.gyeonggi.yongin_si",
    "scrapers.gyeonggi.namyangju_si",
    # 전라북도
    "scrapers.jeonbuk.jeonbuk_batch",
    "scrapers.jeonbuk.jeonbuk_list_batch",
    # 전라남도
    "scrapers.jeonnam.jeonnam_batch",
    "scrapers.jeonnam.jeonnam_list_batch",
    # 대전광역시
    "scrapers.daejeon.daejeon_si",
    # 서울특별시 (5 of 8 — molit/env-ministry endpoints block bare requests)
    "scrapers.seoul.seoul_si",
    "scrapers.seoul.suwon_kukto",
    "scrapers.seoul.sisul",
    "scrapers.seoul.ish",
    "scrapers.seoul.doro_seoul",
    # 부산광역시 (8 of 10 — 부산지방국토관리청, 진영 국토관리사무소 fail/404)
    "scrapers.busan.busan_si",
    "scrapers.busan.jinju_kukto",
    "scrapers.busan.daegu_kukto",
    "scrapers.busan.pohang_kukto",
    "scrapers.busan.yeongju_kukto",
    "scrapers.busan.busan_gunsul",
    "scrapers.busan.bisco",
    "scrapers.busan.busan_batch",
    # 대구광역시 (1 of 5 — 대구시청 JS-loaded; 김천/상주시청 404; 대구지방환경청 blocked)
    "scrapers.daegu.daegu_dosi",
    "scrapers.daegu.gimcheon_si",
    "scrapers.daegu.singisul_daegu",
    "scrapers.daegu.daegu_si",
    # 인천광역시 (2 of 3 — 인천도시공사 returns HTTP 500)
    "scrapers.incheon.incheon_si",
    "scrapers.incheon.jonggeon",
    "scrapers.incheon.incheon_si_sap",
    "scrapers.incheon.ih_bid",
    "scrapers.incheon.ih_notice",
    # 광주광역시 (2 of 3 — 도시건설본부 새소식 JS-loaded)
    "scrapers.gwangju.gmcc",
    "scrapers.gwangju.gwangju_si",
    "scrapers.gwangju.gwangju_si_build",
    # 대전광역시 — finishing the metro (8 of 8)
    "scrapers.daejeon.daejeon_kukto",
    "scrapers.daejeon.nonsan_kukto",
    "scrapers.daejeon.chungju_kukto",
    "scrapers.daejeon.boeun_kukto",
    "scrapers.daejeon.yesan_kukto",
    "scrapers.daejeon.daejeon_gunseol",
    "scrapers.daejeon.dcco",
    "scrapers.daejeon.ddc",
    # 울산광역시 (2 of 2)
    "scrapers.ulsan.umca",
    "scrapers.ulsan.ulsan_si",
    # 세종특별시 (2 of 3 — 세종도시교통공사 has no tables, JS-loaded)
    "scrapers.sejong.sejong_si_notice",
    "scrapers.sejong.sejong_si_gosi",
    "scrapers.sejong.sejong_si_pn_c1",
    "scrapers.sejong.sejong_batch",
    # 경상북도 (9 of 38 — most are JS-rendered portal/saeol or open_content)
    "scrapers.gyeongsangbuk.gyeongbuk_batch",
    "scrapers.gyeongsangbuk.bukbu_construction",
    "scrapers.gyeongsangbuk.gbgs",
    # 경상남도 (9 of 32 static + 21 .web Playwright)
    "scrapers.gyeongsangnam.gyeongnam_batch",
    "scrapers.gyeongsangnam.gyeongnam_web_batch",
    # 강원도 (15 of 32 static + 삼척시 .web Playwright)
    "scrapers.gangwon.gangwon_batch",
    "scrapers.gangwon.gangwon_web_batch",
    # 전국 공사/공단
    "scrapers.gongsa.gongsa_batch",
    "scrapers.gongsa.gongsa_web_batch",
    "scrapers.gongsa.kwater_notice",
    "scrapers.gongsa.lh_notice",
    "scrapers.gongsa.info21c",
    "scrapers.gongsa.ex_kr",
    # 제주도 (3 of 4 — 서귀포시청 returns empty initial HTML)
    "scrapers.jeju.jeju_do",
    "scrapers.jeju.jeju_si",
    "scrapers.jeju.jpdc",
]


def main():
    # We rebind V2_ALLOWLIST below if admin overrides exist; without the
    # global declaration Python treats it as a local for the whole function
    # and the `V2_ALLOWLIST | {...}` line crashes with UnboundLocalError.
    global V2_ALLOWLIST
    urllib3.disable_warnings()

    # Windows consoles default to cp949; force UTF-8 with replace fallback so
    # an unprintable emoji in a title can't crash the whole scraper.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="Write all notices to this JSON file")
    ap.add_argument("--only", help="Run only modules whose path contains this substring")
    ap.add_argument(
        "--supabase",
        action="store_true",
        help="Upsert into Supabase. Reads SUPABASE_URL + SUPABASE_SECRET_KEY from env (or .env).",
    )
    args = ap.parse_args()

    stdout_sink = StdoutSink()
    json_sink = JsonFileSink(args.out) if args.out else None
    supabase_sink = None
    if args.supabase:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SECRET_KEY")
        if not url or not key:
            print("ERROR: --supabase requires SUPABASE_URL and SUPABASE_SECRET_KEY in env (.env)", file=sys.stderr)
            sys.exit(2)
        supabase_sink = SupabaseSink(url, key)
        # Load admin-edited URL overrides BEFORE any scraper module is imported.
        # SourceMeta.__post_init__ swaps in the override at construction time, so
        # this must run first or the module-level SOURCE = SourceMeta(...) lines
        # will lock in the hardcoded URL.
        n_overrides = load_overrides_from_supabase(url, key)
        print(f"Loaded {n_overrides} URL override(s) from Supabase.")
        # Admin-approved overrides also pass the v2 allowlist gate, otherwise the
        # filter below silently skips every source whose URL has been edited.
        from scrapers.base import SourceMeta
        if SourceMeta._OVERRIDES:
            V2_ALLOWLIST = V2_ALLOWLIST | {
                v2_norm(u) for u in SourceMeta._OVERRIDES.values()
            }

    total = 0
    skipped_non_v2 = 0
    dropped_non_v2 = 0
    patched_meta = 0
    failures: list[tuple[str, str]] = []
    attempted_sources = 0
    succeeded_sources = 0

    # Open a scrape_runs row at the start of the run so the admin /admin/logs
    # page shows a live "running" entry. Best-effort: a logging failure here
    # must never prevent the actual scrape from executing.
    run_id = None
    if supabase_sink is not None:
        try:
            res = supabase_sink.client.table("scrape_runs").insert({
                "source_filter": args.only,
                "exit_status": "running",
            }).execute()
            if res.data:
                run_id = res.data[0]["id"]
                print(f"Opened scrape_runs id={run_id} (running)")
        except Exception as e:  # noqa: BLE001
            print(f"(could not open scrape_runs: {e})", file=sys.stderr)

    def _log_attempt(src, status, *, notice_count=0, error_text=None, http_status=None, duration_ms=None):
        """Insert a scrape_attempts row. Silently swallows any failure."""
        if run_id is None or supabase_sink is None:
            return
        try:
            supabase_sink.client.table("scrape_attempts").insert({
                "run_id": run_id,
                "region": getattr(src, "region", None),
                "sub_entity": getattr(src, "sub_entity", None),
                "source_page": getattr(src, "source_page", None),
                "source_url": getattr(src, "source_url", None),
                "status": status,
                "notice_count": notice_count,
                "error_text": error_text,
                "http_status": http_status,
                "duration_ms": duration_ms,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:  # noqa: BLE001
            print(f"   (could not log scrape_attempt: {e})", file=sys.stderr)

    for mod_path in SCRAPERS:
        if args.only and args.only not in mod_path:
            continue
        try:
            mod = importlib.import_module(mod_path)
        except Exception as e:  # noqa: BLE001
            print(f"   ✗ IMPORT FAILED {mod_path}: {type(e).__name__}: {e}", file=sys.stderr)
            failures.append((mod_path, repr(e)))
            continue

        # Batch modules export SCRAPERS = [(SourceMeta, scrape_fn), ...]
        # Standard modules export SOURCE + scrape()
        entries = mod.SCRAPERS if hasattr(mod, "SCRAPERS") else [(mod.SOURCE, mod.scrape)]

        for src, scrape_fn in entries:
            if v2_norm(src.source_url) not in V2_ALLOWLIST:
                skipped_non_v2 += 1
                _log_attempt(src, "skipped")
                continue
            print(f"\n── {src.region} / {src.sub_entity} / {src.source_page}")
            print(f"   {src.source_url}")
            attempted_sources += 1
            attempt_start = time.time()
            try:
                notices = scrape_fn()
                before = len(notices)
                notices = [n for n in notices if v2_norm(n.source_url) in V2_ALLOWLIST]
                dropped_non_v2 += before - len(notices)
                # Reconcile metadata to v2's regions.json labels so UI queries match.
                # Notice.notice_id depends on sub_entity (composite hash), so recompute.
                import hashlib as _h
                for n in notices:
                    meta = V2_META.get(v2_norm(n.source_url))
                    if meta and (n.region, n.sub_entity, n.source_page) != meta:
                        n.region, n.sub_entity, n.source_page = meta
                        n.notice_id = _h.sha1(
                            f"{n.sub_entity}|{n.detail_url}".encode("utf-8")
                        ).hexdigest()
                        patched_meta += 1
                count = stdout_sink.write(notices)
                if json_sink:
                    json_sink.write(notices)
                if supabase_sink:
                    supabase_sink.write(notices)
                print(f"   → {count} notices")
                total += count
                succeeded_sources += 1
                _log_attempt(
                    src, "ok",
                    notice_count=count,
                    duration_ms=int((time.time() - attempt_start) * 1000),
                )
            except Exception as e:  # noqa: BLE001
                print(f"   ✗ FAILED: {type(e).__name__}: {e}", file=sys.stderr)
                failures.append((f"{mod_path}/{src.sub_entity}", repr(e)))
                http_status = 0
                try:
                    import requests as _r
                    if isinstance(e, _r.exceptions.HTTPError) and e.response is not None:
                        http_status = e.response.status_code
                except Exception:
                    http_status = 0
                # Per-source attempt row (for /admin/logs)
                _log_attempt(
                    src, "failed",
                    error_text=f"{type(e).__name__}: {str(e)[:500]}",
                    http_status=http_status or None,
                    duration_ms=int((time.time() - attempt_start) * 1000),
                )
                # Persist 4xx/5xx into scrape_errors so the admin UI can surface
                # them as a Realtime toast. Best-effort: a logging failure here
                # must never kill the scrape run.
                if supabase_sink is not None and 400 <= http_status < 600:
                    try:
                        supabase_sink.client.table("scrape_errors").insert({
                            "region": src.region,
                            "sub_entity": src.sub_entity,
                            "source_page": src.source_page,
                            "url_tried": src.source_url,
                            "status_code": http_status,
                            "error_text": f"{type(e).__name__}: {str(e)[:500]}",
                        }).execute()
                    except Exception as log_err:  # noqa: BLE001
                        print(f"   (could not log scrape_error: {log_err})", file=sys.stderr)
            polite_sleep(1.0)

    if json_sink:
        json_sink.flush()
        print(f"\nWrote snapshot → {args.out}")

    print(f"\nTotal notices: {total}")
    print(f"Skipped (not in v2 allowlist): {skipped_non_v2} entries")
    print(f"Dropped from results (non-v2 source_url): {dropped_non_v2} notices")
    print(f"Patched metadata to v2 labels: {patched_meta} notices")

    # Close out scrape_runs row with summary totals. Best-effort.
    if run_id is not None and supabase_sink is not None:
        if not attempted_sources:
            exit_status = "failed"
        elif failures:
            exit_status = "partial"
        else:
            exit_status = "ok"
        try:
            supabase_sink.client.table("scrape_runs").update({
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "total_attempted": attempted_sources,
                "total_succeeded": succeeded_sources,
                "total_failed": len(failures),
                "total_notices": total,
                "exit_status": exit_status,
            }).eq("id", run_id).execute()
            print(f"Closed scrape_runs id={run_id} ({exit_status})")
        except Exception as e:  # noqa: BLE001
            print(f"(could not close scrape_runs: {e})", file=sys.stderr)

    if failures:
        print(f"Failures: {len(failures)}")
        for path, err in failures:
            print(f"  {path}  {err}")
        sys.exit(1)


if __name__ == "__main__":
    main()
