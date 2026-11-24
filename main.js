import { 
  verificarSesion, 
  registrarUsuario, 
  iniciarSesion, 
  cerrarSesion, 
  usuarioActual 
} from './auth.js';

import { 
  obtenerSeriesBD, 
  obtenerComentariosBD, 
  subirImagenStorage, 
  crearSerieBD, 
  eliminarSerieBD, 
  editarSerieBD, 
  agregarComentarioBD 
} from './series.js';

// Referencias a elementos del DOM
const secAuth = document.getElementById('sec-auth');
const secFormulario = document.getElementById('sec-formulario');
const userInfo = document.getElementById('user-info');
const btnLogout = document.getElementById('btn-logout');

const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');

const formSerie = document.getElementById('form-serie');
const contenedorCards = document.getElementById('contenedor-cards');

// ==========================================
// 1. INICIALIZACIÓN Y CONTROL DE INTERFAZ
// ==========================================

// Al iniciar la app, verificamos si hay una sesión previa
verificarSesion((usuario) => {
  actualizarUI(usuario);
  cargarCatalogo();
});

/**
 * Muestra u oculta secciones según si el usuario inició sesión o no
 */
function actualizarUI(usuario) {
  if (usuario) {
    // USUARIO LOGUEADO: Ocultamos el login y mostramos el formulario
    secAuth.style.display = 'none';
    secFormulario.style.display = 'block';
    btnLogout.style.display = 'inline-block';
    userInfo.textContent = `Hola, ${usuario.email}`;
  } else {
    // VISITANTE DESLOGUEADO: Mostramos el formulario de login y ocultamos el de publicación
    secAuth.style.display = 'block';
    secFormulario.style.display = 'none';
    btnLogout.style.display = 'none';
    userInfo.textContent = '';
    document.getElementById('form-auth')?.reset();
  }
}

// Evento: Registrar un nuevo usuario
btnRegister.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    alert('Por favor, completá el email y la contraseña.');
    return;
  }

  const { error } = await registrarUsuario(email, password);
  if (error) {
    alert('Error al registrarse: ' + error.message);
  } else {
    alert('¡Registro exitoso! Ya podés ingresar con tu cuenta.');
  }
});

// Evento: Iniciar sesión
btnLogin.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    alert('Por favor, ingresá email y contraseña.');
    return;
  }

  const { data, error } = await iniciarSesion(email, password);
  if (error) {
    alert('Error al iniciar sesión: ' + error.message);
  } else {
    actualizarUI(data.user);
  }
});

// Evento: Cerrar sesión
btnLogout.addEventListener('click', async () => {
  await cerrarSesion();
  actualizarUI(null);
  cargarCatalogo(); // Recargamos para refrescar permisos de edición/comentario
});

// ==========================================
// 2. CREAR Y PUBLICAR NUEVA RECOMENDACIÓN
// ==========================================

formSerie.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!usuarioActual) {
    alert('Debés iniciar sesión para publicar.');
    return;
  }

  const titulo = document.getElementById('titulo').value;
  const genero = document.getElementById('genero').value;
  const puntuacion = parseFloat(document.getElementById('puntuacion').value);
  const resena = document.getElementById('resena').value;
  const archivoInput = document.getElementById('imagen-file');
  const archivo = archivoInput.files[0];

  let imagenUrl = 'https://via.placeholder.com/300x400?text=Sin+Portada';

  // Subida de imagen al bucket en Supabase
  if (archivo) {
    try {
      imagenUrl = await subirImagenStorage(archivo);
    } catch (err) {
      alert('Error al subir la imagen: ' + err.message);
      return;
    }
  }

  // Estructura del registro a guardar en la tabla 'series'
  const { error } = await crearSerieBD({
    titulo: titulo,
    genero: genero,
    puntuacion: puntuacion,
    resena: resena,
    imagen_url: imagenUrl,
    user_email: usuarioActual.email // Guardamos quién creó la publicación
  });

  if (error) {
    alert('Error al guardar la serie: ' + error.message);
  } else {
    alert('¡Serie recomendada con éxito!');
    formSerie.reset();
    cargarCatalogo();
  }
});

// ==========================================
// 3. OBTENER Y MOSTRAR CATÁLOGO DE SERIES
// ==========================================

async function cargarCatalogo() {
  contenedorCards.innerHTML = '<p>Cargando recomendaciones...</p>';

  // Obtener series desde la base de datos
  const { data: series, error: errSeries } = await obtenerSeriesBD();
  if (errSeries) {
    contenedorCards.innerHTML = '<p>Error al cargar el catálogo.</p>';
    return;
  }

  if (!series || series.length === 0) {
    contenedorCards.innerHTML = '<p>Aún no hay recomendaciones. ¡Sé el primero en agregar una!</p>';
    return;
  }

  // Obtener comentarios
  const { data: comentarios } = await obtenerComentariosBD();
  contenedorCards.innerHTML = '';

  // Renderizar cada card de serie
  series.forEach(serie => {
    // Verificamos si el usuario activo es el dueño de la publicación
    const esPropietario = usuarioActual && usuarioActual.email === serie.user_email;
    const comentariosSerie = comentarios ? comentarios.filter(c => c.serie_id === serie.id) : [];

    let listaComentariosHTML = '';
    comentariosSerie.forEach(c => {
      listaComentariosHTML += `
        <div class="comentario-item">
          <strong>${c.user_email.split('@')[0]}:</strong> ${c.texto}
        </div>
      `;
    });

    const cardHTML = `
      <article class="card-serie">
        <img src="${serie.imagen_url}" alt="Portada de ${serie.titulo}" onerror="this.src='https://via.placeholder.com/300x400?text=Sin+Imagen'">
        <div class="card-body">
          <div class="card-header-info">
            <span class="badge-genero">${serie.genero}</span>
            <span class="score">★ ${serie.puntuacion}</span>
          </div>
          <h3 class="card-title">${serie.titulo}</h3>
          <p class="card-resena">${serie.resena}</p>
          <div class="card-footer-author">Recomendado por: <strong>${serie.user_email}</strong></div>

          <!-- Solo mostramos botones de edición/borrado al dueño de la publicación -->
          ${esPropietario ? `
            <div class="card-actions">
              <button onclick="editarSerie(${serie.id}, '${serie.resena.replace(/'/g, "\\'")}', ${serie.puntuacion})" class="btn-action btn-edit">Editar</button>
              <button onclick="eliminarSerie(${serie.id})" class="btn-action btn-delete">Eliminar</button>
            </div>
          ` : ''}

          <!-- Sección de comentarios -->
          <div class="seccion-comentarios">
            <h4>Comentarios (${comentariosSerie.length})</h4>
            <div class="lista-comentarios">
              ${listaComentariosHTML || '<p class="sin-comentarios">Sin comentarios aún.</p>'}
            </div>

            ${usuarioActual ? `
              <div class="form-comentario">
                <input type="text" id="input-comentario-${serie.id}" placeholder="Escribí un comentario..." />
                <button onclick="agregarComentario(${serie.id})" class="btn-comentar">Enviar</button>
              </div>
            ` : '<p class="aviso-login-comentario">Iniciá sesión para comentar.</p>'}
          </div>
        </div>
      </article>
    `;
    contenedorCards.innerHTML += cardHTML;
  });
}

// ==========================================
// 4. FUNCIONES GLOBALES PARA EVENTOS ONCLICK
// ==========================================

// Agregar un nuevo comentario
window.agregarComentario = async function(serieId) {
  const input = document.getElementById(`input-comentario-${serieId}`);
  const texto = input.value.trim();

  if (!texto) {
    alert("Escribí algo antes de enviar.");
    return;
  }

  const { error } = await agregarComentarioBD(serieId, texto, usuarioActual.email);
  if (error) {
    alert("Error al comentar: " + error.message);
  } else {
    input.value = '';
    cargarCatalogo();
  }
};

// Eliminar una serie con confirmación nativa
window.eliminarSerie = async function(id) {
  const confirmacion = confirm("¿Estás seguro/a de que querés borrar esta recomendación?");
  if (!confirmacion) return;

  const { error } = await eliminarSerieBD(id);
  if (error) {
    alert("Error al eliminar: " + error.message);
  } else {
    alert("¡Recomendación eliminada con éxito!");
    cargarCatalogo();
  }
};

// Editar una serie mediante ventanas prompt nativas
window.editarSerie = async function(id, resenaActual, puntuacionActual) {
  const nuevaResena = prompt("Modificá tu reseña:", resenaActual);
  if (nuevaResena === null) return; // Si hace clic en Cancelar

  const nuevaPuntuacion = prompt("Modificá la puntuación (1 al 10):", puntuacionActual);
  if (nuevaPuntuacion === null) return;

  const puntuacionNum = parseFloat(nuevaPuntuacion);
  if (isNaN(puntuacionNum) || puntuacionNum < 1 || puntuacionNum > 10) {
    alert("Por favor ingresá un número válido entre 1 y 10.");
    return;
  }

  const { error } = await editarSerieBD(id, nuevaResena, puntuacionNum);
  if (error) {
    alert("Error al actualizar: " + error.message);
  } else {
    alert("¡Recomendación actualizada!");
    cargarCatalogo();
  }
};