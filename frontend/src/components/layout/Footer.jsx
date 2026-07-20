export default function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-center">
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} Automation, UTAC Thai Limited.
        </p>
      </div>
    </footer>
  );
}