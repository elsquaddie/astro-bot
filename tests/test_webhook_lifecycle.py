import importlib


def test_webhook_is_not_deleted_on_shutdown_by_default(monkeypatch):
    monkeypatch.setenv("BOT_MODE", "webhook")
    monkeypatch.delenv("DELETE_WEBHOOK_ON_SHUTDOWN", raising=False)

    import src.config
    import src.main

    importlib.reload(src.config)
    main = importlib.reload(src.main)

    assert main.should_delete_webhook_on_shutdown() is False


def test_webhook_can_be_deleted_on_shutdown_for_local_cleanup(monkeypatch):
    monkeypatch.setenv("BOT_MODE", "webhook")
    monkeypatch.setenv("DELETE_WEBHOOK_ON_SHUTDOWN", "true")

    import src.config
    import src.main

    importlib.reload(src.config)
    main = importlib.reload(src.main)

    assert main.should_delete_webhook_on_shutdown() is True
