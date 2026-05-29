import sys
import random
import string
from app_config import AppConfig
from app_login import AppLogin
from app_db import AppDB


def get_user_pass(user_id):
    random.seed(user_id)
    characters = string.ascii_letters + string.digits

    return ''.join(random.choice(characters) for _ in range(10))


def main(env_param, user_id):
    conf_path = './conf/conf_dev.json'
    if env_param == 'PROD':
        conf_path = './conf/conf_prod.json'
    user_pass = get_user_pass(user_id)
    conf = AppConfig(conf_path)
    login = AppLogin(conf)
    db = AppDB(None, conf, None)
    user_hash = login.get_pw_hash(user_pass)

    db.create_user(user_id, user_hash)
    print(f"create user sucess!!: password: {user_pass}")
    db_hash = db.get_user_hash(user_id)
    print(f"create user check: {login.verify_password(user_pass, db_hash)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
