from src.evaluation.scoring import build_report


def generate_report(session_id: str, answers: list[dict]) -> dict:
    return build_report(session_id, answers)
