export default function Spinner({ size = 'md' }) {
  const s = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' }[size];
  return (
    <div className="flex justify-center items-center p-6">
      <div className={`${s} animate-spin rounded-full border-4 border-sky-200 border-t-sky-500`} />
    </div>
  );
}
