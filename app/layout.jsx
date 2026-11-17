import './style.css';
export const metadata = {
  title: 'Линия — измерение скорости скачивания',
  description: 'Десять последовательных загрузок файла с честным подсчётом времени и данных.',
};
export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <a className="skip" href="#main">
          Перейти к содержимому
        </a>
        {children}
      </body>
    </html>
  );
}
