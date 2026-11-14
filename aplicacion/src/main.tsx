import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Los temas van AL FINAL, después de styles.css y de los CSS de cada componente, para que ganen sobre ellos (0.6.1).
import "./estilos/temas.css";
import { iniciarTema } from "./utilidades/temas";

iniciarTema();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
