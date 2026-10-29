"""JSON stdin/stdout adapter for invoking the diagnostic engine from Node.js."""
import json
import sys
from diagnose import diagnose


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        records = payload.get("records") if isinstance(payload, dict) else None
        journey_model = payload.get("journey_model") if isinstance(payload, dict) else None
        if not isinstance(records, list):
            print(json.dumps({"error": "Request must contain a records array."}))
            return 2
        if journey_model is not None and not isinstance(journey_model, dict):
            print(json.dumps({"error": "journey_model must be an object when supplied."}))
            return 2
        report = diagnose(records, journey_model=journey_model)
        print(json.dumps(report, ensure_ascii=False, allow_nan=False))
        return 0
    except Exception as exc:  # keep errors machine-readable; no traceback in API output
        print(json.dumps({"error": f"Diagnostic engine failed: {type(exc).__name__}: {exc}"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
