export function App() {
  const items = [1, 2, 3];

  return (
    <>
      {items.map((item) => (
        <div>{item}</div>
      ))}

      <button style={{ color: "red" }}>
        Click Me
      </button>
    </>
  );
}