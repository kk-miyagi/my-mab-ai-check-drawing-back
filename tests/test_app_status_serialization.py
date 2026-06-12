from state.app_status import AppStatus, Operation, Status


def _sample():
    return AppStatus(
        "u", "e", "g", Status.END,
        [Operation("op", "oid", Status.END)], {}, 123.0)


def test_to_dict_uses_status_key_not_group_status():
    d = _sample().to_dict()
    assert d["status"] == int(Status.END)   # group-status JSON key = "status"
    assert "group_status" not in d
    assert d["user"] == "u"
    assert d["create_time"] == 123.0


def test_round_trip_from_dict():
    s2 = AppStatus.from_dict(_sample().to_dict())
    assert s2.group_status == Status.END
    assert s2.user == "u"
    assert s2.operations[0].operation == "op"
    assert s2.operations[0].status == Status.END
    assert s2.create_time == 123.0


def test_get_dummy_status_does_not_raise():
    d = AppStatus.get_dummy_status()
    assert d.user == "SYSTEM"
    assert d.create_time == -1
