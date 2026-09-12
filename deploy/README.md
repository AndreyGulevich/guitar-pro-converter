# Публикация

Адрес: https://guitar-pro-converter.eva-chat.ru
Исходники: https://github.com/AndreyGulevich/guitar-pro-converter

Это отдельный статический сайт Nginx на сервере eva-chat.ru. Файлы Eva Chat и papalam не используются и не заменяются. Обработка музыки остаётся в браузере.

- DNS: A `guitar-pro-converter` → `185.46.10.204` в зоне eva-chat.ru.
- Сборка: `npm ci && npm run build` локально; на сервер передаётся только `dist/`.
- Каталог выпусков: `/var/www/guitar-pro-converter/releases/`, символьная ссылка `current` на активный выпуск.
- ACME webroot: `/var/www/guitar-pro-converter/acme`.
- Отдельный Nginx site: `/etc/nginx/sites-available/guitar-pro-converter`.

Для первого запуска установите HTTP-конфигурацию `nginx/guitar-pro-converter-http.conf`, включите только этот новый site, выполните `nginx -t` и reload. После появления DNS выпустите сертификат:

```sh
certbot certonly --webroot -w /var/www/guitar-pro-converter/acme -d guitar-pro-converter.eva-chat.ru
```

Затем замените конфигурацию этого site на `nginx/guitar-pro-converter.conf`, выполните `nginx -t` и reload. Certbot использует сохранённый webroot при автоматическом продлении. Последующие обновления требуют передачи новой сборки в новый каталог releases и атомарного переключения current. Для отката переключите current на предыдущий выпуск.
