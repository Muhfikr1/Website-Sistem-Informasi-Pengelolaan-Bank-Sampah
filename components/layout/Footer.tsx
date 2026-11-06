import { siteConfig } from "@/lib/site-config";

export default function Footer() {
    return (
        <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-500">
            &copy; {new Date().getFullYear()} {siteConfig.name}. Seluruh hak cipta dilindungi.
        </footer>
    );
}