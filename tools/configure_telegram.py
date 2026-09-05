"""Configure the approved bot after the public application passes its health check.
Reads ignored .env; never prints tokens or Telegram request URLs.
"""
import json
import sys
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

APP = 'https://smotri-na-nebo.vektordaniil1.chatgpt.site/'

def main():
    config = dict(line.split('=', 1) for line in Path('.env').read_text().splitlines()
                  if '=' in line and not line.startswith('#'))
    token = config['BOT_TOKEN']
    secret = config['TELEGRAM_WEBHOOK_SECRET']
    def call(method, payload=None):
        data = json.dumps(payload or {}).encode()
        req = urllib.request.Request('https://api.telegram.org/bot' + token + '/' + method,
                                     data=data, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=25) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            raise RuntimeError(f'{method}: Telegram HTTP {error.code}') from None
        except Exception:
            raise RuntimeError(f'{method}: connection failed') from None
        if not result.get('ok'):
            raise RuntimeError(f'{method}: rejected')
        return result['result']
    response = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '25', APP + 'api/health'], capture_output=True, check=True)
    health = json.loads(response.stdout)
    if health.get('app') != 'smotri-na-nebo' or health.get('telegram') != 'mini-app':
        raise RuntimeError('Public app health check failed')
    identity = call('getMe')
    if identity.get('username') != 'astro_timing_bot':
        raise RuntimeError('Unexpected bot identity; nothing changed')
    operations = [
        ('setMyName', {'name': 'Смотри на небо.'}),
        ('setMyDescription', {'description': 'Ближайшие астрономические события для вашего города. Откройте приложение, чтобы узнать, когда и куда смотреть и нужен ли телескоп.'}),
        ('setMyShortDescription', {'short_description': 'Астрономические события: когда, где и как смотреть.'}),
        ('setMyCommands', {'commands': [{'command': 'start', 'description': 'Открыть приложение'}, {'command': 'help', 'description': 'Как пользоваться'}]}),
        ('setChatMenuButton', {'menu_button': {'type': 'web_app', 'text': 'Открыть небо', 'web_app': {'url': APP}}}),
        ('setWebhook', {'url': APP + 'api/telegram/webhook', 'secret_token': secret, 'allowed_updates': ['message']}),
    ]
    for method, payload in operations:
        call(method, payload)
        print(method + ': ok', flush=True)
    hook, menu = call('getWebhookInfo'), call('getChatMenuButton')
    assert hook['url'] == APP + 'api/telegram/webhook'
    assert menu['web_app']['url'] == APP
    print('Verified @astro_timing_bot menu and webhook. Pending updates:', hook['pending_update_count'])

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Configuration stopped:', str(error) if isinstance(error, RuntimeError) else type(error).__name__)
        sys.exit(1)
