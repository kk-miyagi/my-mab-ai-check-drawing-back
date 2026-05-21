from dataclasses import dataclass


@dataclass
class FileInfo:
    save_paths: list[str]
    filenames: list[str]
    file_contents: list[str]
    number: str


@dataclass
class MultiFileUploadInfo:
    user: str
    epic: str
    operation: str
    operation_id: str
    status: str
    file_infos: list[FileInfo]
    sum_number: int
