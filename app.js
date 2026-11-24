import { 
  verificarSesion, 
  registrarUsuario, 
  iniciarSesion, 
  cerrarSesion, 
  usuarioActual 
} from './auth.js';

import { supabase } from './supabaseClient.js';

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
const gridSeries = document.getElementById('grid-series') || document.getElementById('contenedor-cards');
const inputId = document.getElementById('serie-id') || { value: '' };
const tituloForm = document.querySelector('.panel__titulo') || document.querySelector('.bloque__titulo');
const btnSubmit = formSerie ? formSerie.querySelector('button[type="submit"]') : null;

// ==========================================
// 1. INICIALIZACIÓN Y CONTROL DE INTERFAZ
// ==========================================

verificarSesion((usuario) => {
  actualizarUI(usuario);
  cargarCatalogo();
});

function actualizarUI(usuario) {
  if (usuario) {
    if (secAuth) secAuth.style.display = 'none';
    if (secFormulario) secFormulario.style.display = 'block';
    if (btnLogout) btnLogout.style.display = 'inline-block';
    if (userInfo) userInfo.textContent = `Hola, ${usuario.email}`;
  } else {
    if (secAuth) secAuth.style.display = 'block';
    if (secFormulario) secFormulario.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'none';
    if (userInfo) userInfo.textContent = '';
    document.getElementById('form-auth')?.reset();
  }
}

if (btnRegister) {
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
}

if (btnLogin) {
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
}

if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await cerrarSesion();
    actualizarUI(null);
    cargarCatalogo();
  });
}

// ==========================================
// 2. CREAR / ACTUALIZAR RECOMENDACIÓN (SUBMIT)
// ==========================================

if (formSerie) {
  formSerie.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!usuarioActual) {
      alert('Debés iniciar sesión para publicar.');
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Guardando...';
    }

    try {
      const id = inputId.value;

      // Captura de todos los campos del formulario
      const titulo = document.getElementById('titulo').value.trim();
      const tipo = document.getElementById('tipo').value;
      const genero = document.getElementById('genero').value;
      const anio = document.getElementById('anio').value;
      const plataforma = document.getElementById('plataforma').value.trim();
      const puntuacion = parseFloat(document.getElementById('puntuacion').value);
      const fechaVista = document.getElementById('fecha-vista').value;
      const resena = document.getElementById('resena').value.trim();
      const motivo = document.getElementById('motivo').value.trim();

      const idealParaChecked = Array.from(document.querySelectorAll('input[name="ideal_para"]:checked'))
        .map(cb => cb.value);

      const volverAVer = document.querySelector('input[name="revision"]:checked')?.value || '';
      const contieneSpoilers = document.getElementById('spoilers').checked;

      const usuarioInput = document.getElementById('usuario');
      const usuario = usuarioInput ? usuarioInput.value.trim() : usuarioActual.email.split('@')[0];

      const archivoInput = document.getElementById('imagen-file');
      const archivo = archivoInput ? archivoInput.files[0] : null;

      let imagenUrl = 'https://placehold.co/300x400?text=Sin+Portada';

      if (archivo) {
        const nombreArchivo = `${Date.now()}_${archivo.name}`;
        const { error: storageError } = await supabase.storage
          .from('portadas')
          .upload(nombreArchivo, archivo);

        if (storageError) {
          throw new Error("Error al subir la imagen: " + storageError.message);
        }

        const { data: urlData } = supabase.storage
          .from('portadas')
          .getPublicUrl(nombreArchivo);

        imagenUrl = urlData.publicUrl;
      }

      // --- MODO A: ACTUALIZAR (UPDATE) ---
      if (id) {
        const datosActualizados = {
          titulo,
          tipo,
          genero,
          anio: anio ? parseInt(anio) : null,
          plataforma,
          puntuacion,
          fecha_vista: fechaVista || null,
          resena,
          motivo,
          ideal_para: idealParaChecked,
          volver_a_ver: volverAVer,
          spoilers: contieneSpoilers,
          usuario,
          user_email: usuarioActual.email
        };

        if (archivo) {
          datosActualizados.imagen_url = imagenUrl;
        }

        const { error } = await supabase
          .from('series')
          .update(datosActualizados)
          .eq('id', id);

        if (error) throw error;
        alert('¡Recomendación actualizada con éxito!');

      // --- MODO B: CREAR NUEVA (INSERT) ---
      } else {
        const nuevaSerie = {
          titulo,
          tipo,
          genero,
          anio: anio ? parseInt(anio) : null,
          plataforma,
          puntuacion,
          fecha_vista: fechaVista || null,
          resena,
          motivo,
          ideal_para: idealParaChecked,
          volver_a_ver: volverAVer,
          spoilers: contieneSpoilers,
          usuario,
          user_email: usuarioActual.email,
          imagen_url: imagenUrl
        };

        const { error } = await supabase
          .from('series')
          .insert([nuevaSerie]);

        if (error) throw error;
        alert('¡Serie recomendada y guardada con éxito!');
      }

      cancelarEdicion();
      await cargarCatalogo();

    } catch (err) {
      alert(err.message);
      console.error("Error en submit:", err);
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = inputId.value ? 'Guardar Cambios' : 'Publicar recomendación';
      }
    }
  });
}

// ==========================================
// 3. OBTENER Y MOSTRAR CATÁLOGO DE SERIES
// ==========================================

async function cargarCatalogo() {
  if (!gridSeries) return;

  gridSeries.innerHTML = '<p class="subtitle">Cargando recomendaciones...</p>';

  const { data: series, error } = await supabase
    .from('series')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error al cargar series:", error);
    gridSeries.innerHTML = '<p class="subtitle">Error al cargar las series.</p>';
    return;
  }

  if (!series || series.length === 0) {
    gridSeries.innerHTML = '<p class="subtitle">Aún no hay recomendaciones. ¡Sé el primero en publicar una!</p>';
    return;
  }

  // Obtener comentarios si tienes tabla de comentarios (opcional)
  let comentarios = [];
  try {
    const { data: coms } = await supabase.from('comentarios').select('*');
    comentarios = coms || [];
  } catch (e) {
    // Si no existe la tabla de comentarios aún, continúa sin romper
  }

  gridSeries.innerHTML = '';

  series.forEach(serie => {
    const esPropietario = usuarioActual && usuarioActual.email === serie.user_email;
    const comentariosSerie = comentarios.filter(c => c.serie_id === serie.id);

    let listaComentariosHTML = '';
    comentariosSerie.forEach(c => {
      listaComentariosHTML += `
        <div class="comentario-item">
          <strong>${c.user_email ? c.user_email.split('@')[0] : 'Anónimo'}:</strong> ${c.texto}
        </div>
      `;
    });

    let idealParaTexto = 'Ninguno';
    if (serie.ideal_para && Array.isArray(serie.ideal_para) && serie.ideal_para.length > 0) {
      idealParaTexto = serie.ideal_para.join(', ');
    } else if (typeof serie.ideal_para === 'string') {
      idealParaTexto = serie.ideal_para;
    }

    const card = document.createElement('article');
    card.className = 'card-serie';

    card.innerHTML = `
      <img src="${serie.imagen_url}" alt="Portada de ${serie.titulo}" onerror="this.src='https://placehold.co/300x400?text=Sin+Portada'">
      <div class="card-body">
        
        <div class="card-header-info">
          <span class="badge-tipo">${serie.tipo || 'Contenido'}</span>
          <span class="badge-genero">${serie.genero || 'General'}</span>
          <span class="score">★ ${serie.puntuacion || 0}/10</span>
        </div>

        <h3 class="card-title">${serie.titulo} ${serie.anio ? `(${serie.anio})` : ''}</h3>
        
        <div class="card-details-grid">
          <p><strong>Plataforma:</strong> ${serie.plataforma || 'No especificada'}</p>
          <p><strong>Terminada el:</strong> ${serie.fecha_vista || 'No especificada'}</p>
          <p><strong>¿La volvería a ver?:</strong> ${serie.volver_a_ver ? serie.volver_a_ver.toUpperCase() : 'No'}</p>
          <p><strong>Ideal para:</strong> ${idealParaTexto}</p>
          ${serie.spoilers ? '<span class="badge-spoilers">⚠️ Contiene spoilers</span>' : ''}
        </div>

        <div class="card-texts">
          <p class="card-resena"><strong>Reseña:</strong> ${serie.resena || ''}</p>
          <p class="card-motivo"><strong>Motivo:</strong> ${serie.motivo || ''}</p>
        </div>

        <div class="card-footer-author">
          Publicado por: <strong>${serie.usuario || 'Anónimo'}</strong>
        </div>

        ${esPropietario ? `
          <div class="card-actions">
            <button class="btn-action btn-edit" onclick="prepararEdicion(${serie.id})">✏️ Editar</button>
            <button class="btn-action btn-delete" onclick="eliminarSerie(${serie.id})">🗑️ Eliminar</button>
          </div>
        ` : ''}

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
    `;

    gridSeries.appendChild(card);
  });
}

// ==========================================
// 4. ACCIONES GLOBALES (ELIMINAR, EDITAR, COMENTAR)
// ==========================================

window.eliminarSerie = async function(id) {
  const confirmacion = confirm("¿Estás seguro de que querés eliminar esta recomendación?");
  if (!confirmacion) return;

  try {
    const { error } = await supabase.from('series').delete().eq('id', id);
    if (error) throw error;

    alert("Serie eliminada con éxito.");
    if (inputId.value == id) cancelarEdicion();
    await cargarCatalogo();
  } catch (err) {
    alert("Error al eliminar: " + err.message);
  }
};

window.prepararEdicion = async function(id) {
  try {
    const { data: serie, error } = await supabase
      .from('series')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    inputId.value = serie.id;
    document.getElementById('titulo').value = serie.titulo || '';
    document.getElementById('tipo').value = serie.tipo || '';
    document.getElementById('genero').value = serie.genero || '';
    document.getElementById('anio').value = serie.anio || '';
    document.getElementById('plataforma').value = serie.plataforma || '';
    document.getElementById('puntuacion').value = serie.puntuacion || '';
    document.getElementById('fecha-vista').value = serie.fecha_vista || '';
    document.getElementById('resena').value = serie.resena || '';
    document.getElementById('motivo').value = serie.motivo || '';

    document.querySelectorAll('input[name="ideal_para"]').forEach(cb => {
      cb.checked = serie.ideal_para && serie.ideal_para.includes(cb.value);
    });

    if (serie.volver_a_ver) {
      const radioRevision = document.querySelector(`input[name="revision"][value="${serie.volver_a_ver}"]`);
      if (radioRevision) radioRevision.checked = true;
    }

    document.getElementById('spoilers').checked = !!serie.spoilers;
    const usuarioInput = document.getElementById('usuario');
    if (usuarioInput) usuarioInput.value = serie.usuario || '';
    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.value = serie.user_email || '';

    document.getElementById('imagen-file').required = false;

    if (tituloForm) tituloForm.textContent = 'Editar Recomendación';
    if (btnSubmit) btnSubmit.textContent = 'Guardar Cambios';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    alert("No se pudo cargar para editar: " + err.message);
  }
};

window.agregarComentario = async function(serieId) {
  const input = document.getElementById(`input-comentario-${serieId}`);
  const texto = input ? input.value.trim() : '';

  if (!texto) {
    alert("Escribí un comentario antes de enviar.");
    return;
  }

  try {
    const { error } = await supabase.from('comentarios').insert([{
      serie_id: serieId,
      texto: texto,
      user_email: usuarioActual.email
    }]);

    if (error) throw error;
    input.value = '';
    await cargarCatalogo();
  } catch (err) {
    alert("Error al comentar: " + err.message);
  }
};

function cancelarEdicion() {
  formSerie.reset();
  if (inputId) inputId.value = '';
  document.getElementById('imagen-file').required = true;
  if (tituloForm) tituloForm.textContent = 'Contá qué vale la pena ver';
  if (btnSubmit) btnSubmit.textContent = 'Publicar recomendación';
}