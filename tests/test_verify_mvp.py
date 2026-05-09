import pytest

from scripts.verify_mvp import run


@pytest.mark.asyncio
async def test_verify_i18n_target_reports_passing_checks():
    results = await run("i18n")

    assert results
    assert {result.feature for result in results} == {"i18n"}
    assert all(result.passed for result in results)
