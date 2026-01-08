import os


LOGGING_CONFIG: dict[str, any] = {
    # ロギングの設定バージョン (固定で 1 を指定)
    "version": 1,

    # 既存のロガーを無効にしない (他のロガー設定を保持する)
    "disable_existing_loggers": False,

    # 【フォーマッターの設定】ログの出力フォーマットを定義
    "formatters": {
        # デフォルトのフォーマット (主に uvicorn.error で使用)
        "default": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": "%(levelprefix)s %(message)s",
            "use_colors": True,  # ANSI カラー出力 (ターミナルによって自動調整)
        },
        # アクセスログのフォーマット (HTTP リクエスト情報を含む)
        "access": {
            "()": "uvicorn.logging.AccessFormatter",
            "fmt": '%(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s',  # クライアントIP、リクエスト、ステータスコードを表示
        },
    },

    # 【ハンドラーの設定】ログの出力先を定義
    "handlers": {
        # 標準ログの出力先 (uvicorn.error など)
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",  # 出力先を標準エラー (stderr) に指定
        },
        "rotating_file": {
            "formatter": "default",
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": os.path.join("./logs/", "uvicorn.log"),
            "when": "D",
            "interval": 1,
            "backupCount": 60,
        },
        # アクセスログの出力先 (uvicorn.access 用)
        "access": {
            "formatter": "access",  # 上記の "access" フォーマッターを使用
            "class": "logging.StreamHandler",  # 標準出力に送るストリームハンドラー
            "stream": "ext://sys.stdout",  # 出力先を標準出力 (stdout) に指定
        },
        "access_rotating_file": {
            "formatter": "access",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": os.path.join("./logs/", "uvicorn.log"),
            "maxBytes": 50 * 1024,  # 1MB 超えたらローテーション
            "backupCount": 30,
        },
    },

    # 【ロガーの設定】各ロガーが使用するハンドラーとログレベルを定義
    "loggers": {
        # メインの Uvicorn ロガー (デフォルトでは出力されない)
        "uvicorn": {
            "handlers": ["default", "rotating_file"],  # 標準ログのハンドラーを使用
            "level": "INFO",  # INFO レベル以上を出力
            "propagate": False,  # 他のロガーにログを伝播させない
        },
        # エラーログ (起動メッセージや例外ログを出力)
        "uvicorn.error": {
            "level": "INFO",  # INFO レベル以上を出力 (ハンドラーは root logger に委任)
        },
        # アクセスログ (HTTP リクエストログを出力)
        "uvicorn.access": {
            "handlers": ["access", "access_rotating_file"],  # アクセスログ専用のハンドラーを使用
            "level": "INFO",  # INFO レベル以上を出力
            "propagate": False,  # 他のロガーにログを伝播させない
        },
    },
}
