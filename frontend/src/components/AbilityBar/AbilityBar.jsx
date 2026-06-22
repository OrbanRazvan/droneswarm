import { FaForward, FaShieldAlt, FaMagnet } from 'react-icons/fa';
import { GiTripleNeedle } from 'react-icons/gi';
import './AbilityBar.css';

function AbilityBar() {
  return (
    <div className="ability-bar">
      <div className="ability">
        <FaForward />
        <span>SHIFT</span>
        <small>SPEED</small>
      </div>

      <div className="ability">
        <GiTripleNeedle />
        <span>E</span>
        <small>SPLIT</small>
      </div>

      <div className="ability">
        <FaShieldAlt />
        <span>SPACE</span>
        <small>SHIELD</small>
      </div>

      <div className="ability">
        <FaMagnet />
        <span>RMB</span>
        <small>MAGNET</small>
      </div>
    </div>
  );
}

export default AbilityBar;