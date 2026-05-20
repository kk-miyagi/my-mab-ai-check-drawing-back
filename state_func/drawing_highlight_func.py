from state.drawing_highlight_info import DrawingHighlightInfo


def create_drawing_highlight_info(self):
    with self.lock:
        if not hasattr(
            self.app_state,
            'DRAWING_HIGHLIGHT_SESSION_KEY'
        ):
            self.app_state.DRAWING_HIGHLIGHT_SESSION_KEY = {}


def get_drawing_highlight_info(self, req_status):
    with self.lock:
        ret = self.app_state.DRAWING_HIGHLIGHT_SESSION_KEY[
            req_status.get_hash_key()
        ]
    return ret


def update_drawing_highlight_info(self, status):
    with self.lock:
        session_dic = self.app_state.DRAWING_HIGHLIGHT_SESSION_KEY
        if status.get_hash_key() not in session_dic:
            session_dic[status.get_hash_key()] = DrawingHighlightInfo(
                status.user,
                status.epic,
                status.group_id,
                status.operation,
                status.operation_id,
            )
        else:
            info = session_dic[status.get_hash_key()]
            info.group_status = status.group_status
