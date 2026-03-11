import { WEBAPP_LOGIN_URL } from "@/lib/webapp-url"

export function Header() {
  return (
    <header className="w-full border-b border-[#37322f]/6 bg-[#f7f5f3]">
      <div className="max-w-[1060px] mx-auto px-4">
        <nav className="flex items-center justify-between py-4">
          <div className="flex items-center space-x-8">
            <div className="text-[#37322f] font-semibold text-lg">Undefined AI</div>
            <div className="hidden md:flex items-center space-x-6">
              <button className="text-[#37322f] hover:text-[#37322f]/80 text-sm font-medium">Products</button>
              <button className="text-[#37322f] hover:text-[#37322f]/80 text-sm font-medium">Pricing</button>
              <button className="text-[#37322f] hover:text-[#37322f]/80 text-sm font-medium">Docs</button>
            </div>
          </div>
          <a
            href={WEBAPP_LOGIN_URL}
            className="text-[#37322f] hover:bg-[#37322f]/5 text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            Log in
          </a>
        </nav>
      </div>
    </header>
  )
}
