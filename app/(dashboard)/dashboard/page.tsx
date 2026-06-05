export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">خلاصه وضعیت</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <h3 className="font-semibold text-lg">ربات‌های فعال</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <h3 className="font-semibold text-lg">کمپین‌های در حال اجرا</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
          <h3 className="font-semibold text-lg">پست‌های ارسال شده</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
      </div>
    </div>
  );
}
