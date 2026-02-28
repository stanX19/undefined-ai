# DONT TOUCH!! DEVELOPED BY ANOTHER DEVELOPER!!

from pydantic import BaseModel


class UrlMetadata(BaseModel):
    title: str
    ...

class SearchResultItem:
    url: str
    metadata: UrlMetadata

WebContent = str

class UrlContentPair:
    url_data: SearchResultItem
    content: WebContent

class WebSearchService:
    DEFAULT_TTS_LANG = "en"  # "ms"

    @staticmethod
    async def search(query: str) -> list[SearchResultItem]:
        ...

    async def get_web_content(self, url: str) -> WebContent:
        ...

    async def search_and_get_all_content(self, query, ) -> list[UrlContentPair]:
        ...


if __name__ == '__main__':
    # insert your test for every single function here
    ...