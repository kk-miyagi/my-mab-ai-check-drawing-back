from pypdf import PdfReader

def is_single_page_pdf(file_path):
    """pdfファイルが1ページであることを確認する関数"""
    try:
        is_single_page = False
        reader = PdfReader(file_path)
        is_single_page = len(reader.pages) == 1
        return is_single_page
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return False
