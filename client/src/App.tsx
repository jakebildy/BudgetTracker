import styles from "./App.module.css";
import { HomePage } from "./pages/HomePage";

export function App() {
  return (
    <div className={styles.shell}>
      <HomePage />
    </div>
  );
}
