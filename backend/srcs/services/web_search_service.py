import asyncio
import traceback
from pydantic import BaseModel
from exa_py import Exa

from srcs.config import get_settings

_client: Exa | None = None


def _get_client() -> Exa:
    global _client
    if _client is None:
        settings = get_settings()
        _client = Exa(api_key=settings.EXA_API_KEY)
    return _client


class UrlMetadata(BaseModel):
    title: str
    published_date: str | None = None


class SearchResultItem(BaseModel):
    url: str
    metadata: UrlMetadata


WebContent = str


class UrlContentPair(BaseModel):
    url_data: SearchResultItem
    content: WebContent


class WebSearchService:
    DEFAULT_NUM_RESULTS = 5

    @staticmethod
    async def search(query: str, num_results: int = DEFAULT_NUM_RESULTS) -> list[SearchResultItem]:
        """Search the web using Exa and return a list of URLs with metadata."""
        client = _get_client()

        def _search():
            return client.search(
                query=query,
                type="auto",
                num_results=num_results,
            )

        response = await asyncio.to_thread(_search)

        return [
            SearchResultItem(
                url=result.url,
                metadata=UrlMetadata(
                    title=result.title or "",
                    published_date=result.published_date,
                ),
            )
            for result in response.results
        ]

    @staticmethod
    async def get_web_content(url: str) -> WebContent:
        """Fetch the text content of a single URL via Exa."""
        client = _get_client()

        def _get_contents():
            return client.get_contents([url], text=True)

        response = await asyncio.to_thread(_get_contents)

        if response.results:
            return response.results[0].text or ""
        return ""

    @staticmethod
    async def search_and_get_all_content(
        query: str,
        num_results: int = DEFAULT_NUM_RESULTS,
    ) -> list[UrlContentPair]:
        """Search the web and retrieve full text content for every result in one call."""
        client = _get_client()

        def _search_and_contents():
            return client.search_and_contents(
                query=query,
                type="auto",
                num_results=num_results,
                text=True,
            )

        response = await asyncio.to_thread(_search_and_contents)

        return [
            UrlContentPair(
                url_data=SearchResultItem(
                    url=result.url,
                    metadata=UrlMetadata(
                        title=result.title or "",
                        published_date=result.published_date,
                    ),
                ),
                content=result.text or "",
            )
            for result in response.results
        ]


if __name__ == "__main__":
    import sys

    if sys.platform.startswith("win") and sys.version_info < (3, 14):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def main():
        service = WebSearchService()

        print("=== search() ===")
        results = await service.search("quantum computing basics")
        for r in results:
            print(f"  {r.metadata.title} -> {r.url}")

        print("\n=== get_web_content() ===")
        if results:
            content = await service.get_web_content(results[0].url)
            print(f"  Content length: {len(content)} chars")
            print(f"  Preview: {content[:300]}...")

        print("\n=== search_and_get_all_content() ===")
        pairs = await service.search_and_get_all_content("quantum computing basics", num_results=3)
        for pair in pairs:
            print(f"  {pair.url_data.metadata.title}")
            print(f"    URL: {pair.url_data.url}")
            print(f"    Content preview: {pair.content[:200]}...")
            print()

    asyncio.run(main())
