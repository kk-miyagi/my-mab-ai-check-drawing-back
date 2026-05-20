from state.image_similarity_info import ImageSimilarityInfo


def create_image_similarity_info(self):
    with self.lock:
        if not hasattr(
            self.app_state,
            'IMAGE_SIMILARITY_SESSION_KEY'
        ):
            self.app_state.IMAGE_SIMILARITY_SESSION_KEY = {}


def get_image_similarity_info(self, req_status):
    with self.lock:
        ret = self.app_state.IMAGE_SIMILARITY_SESSION_KEY[
            req_status.get_hash_key()
        ]
    return ret


def update_image_similarity_info(self, status):
    with self.lock:
        session_dic = self.app_state.IMAGE_SIMILARITY_SESSION_KEY
        if status.get_hash_key() not in session_dic:
            session_dic[status.get_hash_key()] = ImageSimilarityInfo(
                status.user,
                status.epic,
                status.group_id,
                status.operations[0].operation,
                status.operations[0].operation_id,
            )
        else:
            info = session_dic[status.get_hash_key()]
            info.group_status = status.group_status
