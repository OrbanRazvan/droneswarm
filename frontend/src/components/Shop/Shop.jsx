import "./Shop.css";

function Shop({
  packs = [],
  onOpenPack,
  onSelectSkin,
  selectedDrone,
  DronePreview,
}) {
  return (
    <section className="shop-page">
      <div className="shop-hero">
        <div>
          <span className="shop-kicker">Premium Shop</span>
          <h2>Drone Premium Packs</h2>
          <p>
            Pentru test, pachetele sunt pe modul USE. Apasa pe pachet,
            apoi alege skinul cu SELECT.
          </p>
        </div>

        <div className="shop-price-badge">
          <span>TEST MODE</span>
          <strong>USE</strong>
        </div>
      </div>

      <div className="shop-pack-grid shop-pack-grid-two">
        {packs.slice(0, 2).map((pack) => {
          const hasSelectedSkin = pack.skins.some((skin) => skin.id === selectedDrone);

          return (
            <article
              key={pack.id}
              className={`shop-pack-card ${hasSelectedSkin ? "shop-pack-selected" : ""}`}
            >
              <div className="shop-pack-preview">
                {pack.skins.map((skin) =>
                  DronePreview ? (
                    <div
                      key={skin.id}
                      className={`shop-preview-item ${
                        selectedDrone === skin.id ? "selected-preview-item" : ""
                      }`}
                    >
                      <DronePreview drone={skin} size="tiny" />
                    </div>
                  ) : (
                    <div key={skin.id} className="shop-fallback-dot" />
                  )
                )}
              </div>

              <div className="shop-pack-copy">
                <span>Premium Pack</span>
                <h3>{pack.name}</h3>
                <p>{pack.subtitle}</p>
              </div>

              <div className="shop-pack-footer">
                <strong>USE</strong>
                <button onClick={() => onOpenPack(pack.id)}>OPEN PACK</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default Shop;
